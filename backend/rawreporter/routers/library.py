from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.database import get_db
from rawreporter.dependencies import require_permission
from rawreporter.models.library_finding import LibraryFinding
from rawreporter.models.library_finding_reference import LibraryFindingReference
from rawreporter.schemas.finding import ImportResult
from rawreporter.schemas.library_finding import (
    ImportPayload,
    LibraryFindingCreate,
    LibraryFindingRead,
    LibraryFindingUpdate,
)
from rawreporter.schemas.library_finding_reference import LibraryFindingReferenceRead
from rawreporter.services import audit_service
from rawreporter.services.library_service import (
    copy_library_finding_to_report,
    get_library_findings,
)
from rawreporter.utils.enums import AuditActionEnum, RefTypeEnum, SeverityEnum


class RefUpsert(BaseModel):
    ref_type: RefTypeEnum
    identifier: str
    url: str | None = None
    description: str | None = None
    is_visible: bool = True

router = APIRouter(prefix="/library", tags=["library"])


@router.get("", response_model=list[LibraryFindingRead])
async def list_library_findings(
    vertical: str | None = Query(None),
    severity: SeverityEnum | None = Query(None),
    is_ot_specific: bool | None = Query(None),
    search: str | None = Query(None, description="Case-insensitive title/summary search"),
    _: User = Depends(require_permission("library_finding", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_library_findings(db, vertical, severity, is_ot_specific, search)


@router.post("", response_model=LibraryFindingRead, status_code=status.HTTP_201_CREATED)
async def create_library_finding(
    payload: LibraryFindingCreate,
    _: User = Depends(require_permission("library_finding", "create")),
    db: AsyncSession = Depends(get_db),
):
    finding = LibraryFinding(**payload.model_dump())
    db.add(finding)
    await db.commit()
    await db.refresh(finding)
    return finding


@router.get("/archived", response_model=list[LibraryFindingRead])
async def list_archived_library_findings(
    _: User = Depends(require_permission("library_finding", "archive")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LibraryFinding)
        .where(LibraryFinding.is_archived == True)  # noqa: E712
        .order_by(LibraryFinding.archived_at.desc())
    )
    return result.scalars().all()


@router.get("/{finding_id}", response_model=LibraryFindingRead)
async def get_library_finding(
    finding_id: UUID,
    _: User = Depends(require_permission("library_finding", "view")),
    db: AsyncSession = Depends(get_db),
):
    finding = await db.get(LibraryFinding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Library finding not found")
    return finding


@router.patch("/{finding_id}", response_model=LibraryFindingRead)
async def update_library_finding(
    finding_id: UUID,
    payload: LibraryFindingUpdate,
    _: User = Depends(require_permission("library_finding", "edit")),
    db: AsyncSession = Depends(get_db),
):
    finding = await db.get(LibraryFinding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Library finding not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(finding, field, value)
    await db.commit()
    await db.refresh(finding)
    return finding


@router.delete("/{finding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_library_finding(
    finding_id: UUID,
    request: Request,
    current_user: User = Depends(require_permission("library_finding", "delete")),
    db: AsyncSession = Depends(get_db),
):
    finding = await db.get(LibraryFinding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Library finding not found")
    title = finding.title
    await db.delete(finding)
    await audit_service.log_event(
        session=db,
        action=AuditActionEnum.library_finding_deleted,
        resource_type="library_finding",
        user_id=current_user.id,
        resource_id=finding_id,
        resource_name=title,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()


@router.post("/{finding_id}/archive", response_model=LibraryFindingRead)
async def archive_library_finding(
    finding_id: UUID,
    request: Request,
    user: User = Depends(require_permission("library_finding", "archive")),
    db: AsyncSession = Depends(get_db),
):
    finding = await db.get(LibraryFinding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Library finding not found")
    if finding.is_archived:
        raise HTTPException(status_code=409, detail="Library finding is already archived")
    finding.is_archived = True
    finding.archived_at = datetime.now(timezone.utc)
    finding.archived_by = user.id
    await audit_service.log_event(
        session=db,
        action=AuditActionEnum.library_finding_archived,
        resource_type="library_finding",
        user_id=user.id,
        resource_id=finding_id,
        resource_name=finding.title,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(finding)
    return finding


@router.post("/{finding_id}/restore", response_model=LibraryFindingRead)
async def restore_library_finding(
    finding_id: UUID,
    request: Request,
    current_user: User = Depends(require_permission("library_finding", "restore")),
    db: AsyncSession = Depends(get_db),
):
    finding = await db.get(LibraryFinding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Library finding not found")
    if not finding.is_archived:
        raise HTTPException(status_code=409, detail="Library finding is not archived")
    finding.is_archived = False
    finding.archived_at = None
    finding.archived_by = None
    await audit_service.log_event(
        session=db,
        action=AuditActionEnum.library_finding_restored,
        resource_type="library_finding",
        user_id=current_user.id,
        resource_id=finding_id,
        resource_name=finding.title,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(finding)
    return finding


@router.put("/{finding_id}/references", response_model=list[LibraryFindingReferenceRead])
async def replace_references(
    finding_id: UUID,
    payload: list[RefUpsert],
    _: User = Depends(require_permission("library_finding", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """Atomically replace all references for a library finding."""
    finding = await db.get(LibraryFinding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Library finding not found")

    await db.execute(
        delete(LibraryFindingReference).where(
            LibraryFindingReference.library_finding_id == finding_id
        )
    )
    new_refs = []
    for item in payload:
        ref = LibraryFindingReference(
            library_finding_id=finding_id,
            ref_type=item.ref_type,
            identifier=item.identifier,
            url=item.url,
            description=item.description,
            is_visible=item.is_visible,
        )
        db.add(ref)
        new_refs.append(ref)

    await db.commit()
    for ref in new_refs:
        await db.refresh(ref)
    return new_refs


@router.post("/{finding_id}/import", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
async def import_finding(
    finding_id: UUID,
    payload: ImportPayload,
    _: User = Depends(require_permission("finding", "create")),
    db: AsyncSession = Depends(get_db),
):
    finding = await copy_library_finding_to_report(
        finding_id, payload.report_id, db, payload.target_section_id
    )
    await db.commit()
    await db.refresh(finding)

    from sqlalchemy import select
    from rawreporter.models.report_section import ReportSection
    section_result = await db.execute(
        select(ReportSection).where(ReportSection.id == finding.section_id)
    )
    section = section_result.scalar_one()
    return {"finding": finding, "section": section}
