from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.database import get_db
from rawreporter.dependencies import require_permission
from rawreporter.models.finding import Finding
from rawreporter.models.report import Report
from rawreporter.models.report_section import ReportSection
from rawreporter.models.finding_reference import FindingReference
from rawreporter.schemas.finding import (
    FindingCreate,
    FindingMoveRequest,
    FindingRead,
    FindingRefUpsert,
    FindingReorderRequest,
    FindingSeverityUpdate,
    FindingsBySectionRead,
    FindingUpdate,
)
from rawreporter.utils.enums import RefTypeEnum
from rawreporter.services import finding_service

router = APIRouter(tags=["findings"])


@router.get("/findings", response_model=list[FindingRead])
async def list_findings(
    report_id: UUID | None = None,
    section_id: UUID | None = None,
    _: User = Depends(require_permission("finding", "view")),
    db: AsyncSession = Depends(get_db),
):
    if report_id is None and section_id is None:
        raise HTTPException(status_code=400, detail="report_id or section_id is required")

    stmt = select(Finding).order_by(Finding.position)
    if section_id is not None:
        stmt = stmt.where(Finding.section_id == section_id)
    elif report_id is not None:
        stmt = stmt.where(Finding.report_id == report_id)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/findings", response_model=FindingRead, status_code=status.HTTP_201_CREATED)
async def create_finding(
    payload: FindingCreate,
    _: User = Depends(require_permission("finding", "create")),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, payload.report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    section = await db.get(ReportSection, payload.section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    finding = Finding(**payload.model_dump())
    db.add(finding)
    await db.commit()
    await db.refresh(finding)
    return finding


@router.get("/reports/{report_id}/findings/by-section", response_model=list[FindingsBySectionRead])
async def findings_by_section(
    report_id: UUID,
    _: User = Depends(require_permission("finding", "view")),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    sections_result = await db.execute(
        select(ReportSection)
        .where(ReportSection.report_id == report_id)
        .order_by(ReportSection.position)
    )
    sections = sections_result.scalars().all()

    findings_result = await db.execute(
        select(Finding)
        .where(Finding.report_id == report_id)
        .order_by(Finding.position)
    )
    findings = findings_result.scalars().all()

    findings_by_sid: dict[UUID, list[Finding]] = {s.id: [] for s in sections}
    for f in findings:
        if f.section_id in findings_by_sid:
            findings_by_sid[f.section_id].append(f)

    return [
        {"section": s, "findings": findings_by_sid[s.id]}
        for s in sections
    ]


@router.get("/findings/{finding_id}", response_model=FindingRead)
async def get_finding(
    finding_id: UUID,
    _: User = Depends(require_permission("finding", "view")),
    db: AsyncSession = Depends(get_db),
):
    finding = await db.get(Finding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    return finding


@router.patch("/findings/{finding_id}", response_model=FindingRead)
async def update_finding(
    finding_id: UUID,
    payload: FindingUpdate,
    _: User = Depends(require_permission("finding", "edit")),
    db: AsyncSession = Depends(get_db),
):
    update_data = payload.model_dump(exclude_unset=True)
    severity_fields = {"severity_override", "override_justification"}
    non_severity_fields = {k: v for k, v in update_data.items() if k not in severity_fields}

    if "severity_override" in update_data:
        finding = await finding_service.update_finding_severity(
            finding_id, update_data["severity_override"], db
        )
        if "override_justification" in update_data:
            finding.override_justification = update_data["override_justification"]
    else:
        finding = await db.get(Finding, finding_id)
        if not finding:
            raise HTTPException(status_code=404, detail="Finding not found")

    # Apply any non-severity fields (title, summary, recommendation, etc.)
    for field, value in non_severity_fields.items():
        setattr(finding, field, value)

    await db.commit()
    await db.refresh(finding)
    return finding


@router.patch("/findings/{finding_id}/severity", response_model=FindingRead)
async def update_finding_severity(
    finding_id: UUID,
    payload: FindingSeverityUpdate,
    _: User = Depends(require_permission("finding", "edit")),
    db: AsyncSession = Depends(get_db),
):
    finding = await finding_service.update_finding_severity(finding_id, payload.new_severity, db)
    await db.commit()
    await db.refresh(finding)
    return finding


@router.patch("/findings/{finding_id}/move", response_model=FindingRead)
async def move_finding(
    finding_id: UUID,
    payload: FindingMoveRequest,
    _: User = Depends(require_permission("finding", "move")),
    db: AsyncSession = Depends(get_db),
):
    finding = await finding_service.move_finding_to_section(
        finding_id, payload.target_section_id, payload.new_position, db
    )
    await db.commit()
    await db.refresh(finding)
    return finding


@router.patch("/findings/{finding_id}/reorder", response_model=FindingRead)
async def reorder_finding(
    finding_id: UUID,
    payload: FindingReorderRequest,
    _: User = Depends(require_permission("finding", "move")),
    db: AsyncSession = Depends(get_db),
):
    finding = await finding_service.reorder_finding(finding_id, payload.new_position, db)
    await db.commit()
    await db.refresh(finding)
    return finding


@router.put("/findings/{finding_id}/references", response_model=FindingRead)
async def replace_finding_references(
    finding_id: UUID,
    payload: list[FindingRefUpsert],
    _: User = Depends(require_permission("finding", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """
    Atomically replaces all references for a finding.
    Deletes existing references and inserts the new set in one transaction.
    """
    from sqlalchemy import delete as sa_delete
    finding = await db.get(Finding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    # Delete all existing references
    await db.execute(sa_delete(FindingReference).where(FindingReference.finding_id == finding_id))

    # Insert new references
    for ref in payload:
        db.add(FindingReference(
            finding_id=finding_id,
            ref_type=RefTypeEnum(ref.ref_type),
            identifier=ref.identifier,
            url=ref.url,
            description=ref.description,
            is_visible=ref.is_visible,
        ))

    await db.commit()
    await db.refresh(finding)
    return finding


@router.delete("/findings/{finding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_finding(
    finding_id: UUID,
    _: User = Depends(require_permission("finding", "delete")),
    db: AsyncSession = Depends(get_db),
):
    finding = await db.get(Finding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    await db.delete(finding)
    await db.commit()
