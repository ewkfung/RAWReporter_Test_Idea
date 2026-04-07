import re
import traceback
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.database import get_db
from rawreporter.dependencies import require_permission
from rawreporter.models.engagement import Engagement
from rawreporter.models.report import Report
from rawreporter.models.report_section import ReportSection
from rawreporter.schemas.report import ReportCreate, ReportRead, ReportSectionRead, ReportUpdate
from rawreporter.services import audit_service
from rawreporter.services.report_service import seed_report_sections, validate_report_for_generation
from rawreporter.utils.enums import AuditActionEnum

router = APIRouter(prefix="/reports", tags=["reports"])


# ── List / filter ──────────────────────────────────────────────────────────

@router.get("", response_model=list[ReportRead])
async def list_reports(
    engagement_id: UUID | None = None,
    unlinked: bool = False,
    _: User = Depends(require_permission("report", "view")),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all non-archived reports.
    - Pass ?engagement_id=<id> to filter to one engagement's reports.
    - Pass ?unlinked=true to return only reports with no engagement (used by
      the "Add Report" picker on the Engagements page).
    """
    q = select(Report).where(Report.is_archived == False).order_by(Report.updated_at.desc())  # noqa: E712
    if unlinked:
        q = q.where(Report.engagement_id.is_(None))
    elif engagement_id:
        q = q.where(Report.engagement_id == engagement_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/archived", response_model=list[ReportRead])
async def list_archived_reports(
    _: User = Depends(require_permission("report", "archive")),
    db: AsyncSession = Depends(get_db),
):
    """Returns reports that have been soft-archived, newest first."""
    q = select(Report).where(Report.is_archived == True).order_by(Report.archived_at.desc())  # noqa: E712
    result = await db.execute(q)
    return result.scalars().all()


# ── Create ─────────────────────────────────────────────────────────────────

@router.post("", response_model=ReportRead, status_code=status.HTTP_201_CREATED)
async def create_report(
    payload: ReportCreate,
    _: User = Depends(require_permission("report", "create")),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a report and seeds sections based on the engagement's type.
    engagement_id is required — the engagement type determines which
    builder structure (section layout) to seed.
    """
    from rawreporter.utils.enums import EngagementTypeEnum

    # Determine the section structure to seed.
    # Priority: engagement type → report types[0] → no seeding (empty report).
    engagement_type: EngagementTypeEnum | None = None

    if payload.engagement_id:
        engagement = await db.get(Engagement, payload.engagement_id)
        if not engagement:
            raise HTTPException(status_code=404, detail="Engagement not found")
        if engagement.types:
            try:
                engagement_type = EngagementTypeEnum(engagement.types[0])
            except ValueError:
                pass  # unknown type — skip seeding
    elif payload.types:
        try:
            engagement_type = EngagementTypeEnum(payload.types[0])
        except ValueError:
            pass  # unknown type — skip seeding

    data = payload.model_dump()
    if data.get("start_date") is None:
        data["start_date"] = date.today()
    report = Report(**data)
    db.add(report)
    await db.flush()  # get the report ID before seeding sections

    if engagement_type is not None:
        try:
            await seed_report_sections(report.id, engagement_type, db)
        except HTTPException:
            pass  # unsupported type (tabletop etc.) — create empty report

    await db.commit()
    await db.refresh(report)
    return report


# ── Read ───────────────────────────────────────────────────────────────────

@router.get("/{report_id}", response_model=ReportRead)
async def get_report(
    report_id: UUID,
    request: Request,
    current_user: User = Depends(require_permission("report", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Returns a single report by ID."""
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await audit_service.log_event(
        session=db,
        action=AuditActionEnum.report_viewed,
        resource_type="report",
        user_id=current_user.id,
        resource_id=report_id,
        resource_name=report.title,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return report


@router.get("/{report_id}/sections", response_model=list[ReportSectionRead])
async def list_sections(
    report_id: UUID,
    _: User = Depends(require_permission("report", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Returns all sections for a report, ordered by their display position."""
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    result = await db.execute(
        select(ReportSection)
        .where(ReportSection.report_id == report_id)
        .order_by(ReportSection.position)
    )
    return result.scalars().all()


# ── Update ─────────────────────────────────────────────────────────────────

@router.patch("/{report_id}", response_model=ReportRead)
async def update_report(
    report_id: UUID,
    payload: ReportUpdate,
    _: User = Depends(require_permission("report", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """
    Partially updates a report. Only fields included in the request body
    are changed (exclude_unset ensures omitted fields are left alone).
    """
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(report, field, value)
    await db.commit()
    await db.refresh(report)
    return report


# ── Link / unlink ──────────────────────────────────────────────────────────

@router.post("/{report_id}/link", response_model=ReportRead)
async def link_report(
    report_id: UUID,
    payload: dict,
    _: User = Depends(require_permission("report", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """
    Associates an unlinked report with an engagement.
    Used when a consultant selects existing reports to add via the
    "Add Report" picker on the Engagements page.
    """
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    engagement_id = payload.get("engagement_id")
    if not engagement_id:
        raise HTTPException(status_code=422, detail="engagement_id required")
    engagement = await db.get(Engagement, UUID(engagement_id))
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    report.engagement_id = UUID(engagement_id)
    await db.commit()
    await db.refresh(report)
    return report


@router.post("/{report_id}/unlink", response_model=ReportRead)
async def unlink_report(
    report_id: UUID,
    _: User = Depends(require_permission("report", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """
    Removes a report's association with its engagement (sets engagement_id
    to NULL). The report and all its findings are preserved — it simply
    becomes unlinked and will appear in the "Add Report" picker.
    """
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.engagement_id = None
    await db.commit()
    await db.refresh(report)
    return report


# ── Archive / restore ──────────────────────────────────────────────────────

@router.post("/{report_id}/archive", response_model=ReportRead)
async def archive_report(
    report_id: UUID,
    request: Request,
    current_user: User = Depends(require_permission("report", "archive")),
    db: AsyncSession = Depends(get_db),
):
    """
    Soft-archives a report. It is hidden from the main list but can be
    restored. Data (findings, sections) is fully preserved.
    """
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.is_archived = True
    report.archived_at = datetime.now(timezone.utc)
    await audit_service.log_event(
        session=db,
        action=AuditActionEnum.report_archived,
        resource_type="report",
        user_id=current_user.id,
        resource_id=report_id,
        resource_name=report.title,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(report)
    return report


@router.post("/{report_id}/restore", response_model=ReportRead)
async def restore_report(
    report_id: UUID,
    request: Request,
    current_user: User = Depends(require_permission("report", "archive")),
    db: AsyncSession = Depends(get_db),
):
    """Restores an archived report back to the active list."""
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.is_archived = False
    report.archived_at = None
    await audit_service.log_event(
        session=db,
        action=AuditActionEnum.report_restored,
        resource_type="report",
        user_id=current_user.id,
        resource_id=report_id,
        resource_name=report.title,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(report)
    return report


# ── Delete ─────────────────────────────────────────────────────────────────

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: UUID,
    request: Request,
    current_user: User = Depends(require_permission("report", "delete")),
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently deletes a report and all associated sections and findings.
    This is irreversible — use archive if soft-deletion is preferred.
    """
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    title = report.title
    await db.delete(report)
    await audit_service.log_event(
        session=db,
        action=AuditActionEnum.report_deleted,
        resource_type="report",
        user_id=current_user.id,
        resource_id=report_id,
        resource_name=title,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()


# ── Generate ──────────────────────────────────────────────────────────────

@router.post("/{report_id}/generate")
async def generate_report(
    report_id: UUID,
    _: User = Depends(require_permission("report", "generate")),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a DOCX report file.
    Validates placement overrides before generation.
    Returns a streaming DOCX file download on success.
    """
    from rawreporter.generators.docx_generator import generate_docx

    try:
        docx_bytes = await generate_docx(report_id, db)
    except HTTPException:
        raise
    except Exception:
        logger_msg = traceback.format_exc()
        import logging
        logging.getLogger(__name__).error("Document generation failed:\n%s", logger_msg)
        raise HTTPException(
            status_code=500,
            detail={
                "detail": "Document generation failed. Check server logs for details.",
                "report_id": str(report_id),
            },
        )

    # Build filename
    report = await db.get(Report, report_id)
    title = report.title if report else "report"
    date_str = datetime.utcnow().strftime("%Y%m%d")
    title_slug = re.sub(r"[^a-z0-9_]", "", title.lower().replace(" ", "_")[:40])
    filename = f"{title_slug}_{date_str}.docx"

    return StreamingResponse(
        content=iter([docx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(docx_bytes)),
        },
    )
