import os
from uuid import UUID

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.config import get_settings
from rawreporter.database import get_db
from rawreporter.dependencies import require_permission
from rawreporter.models.evidence import Evidence
from rawreporter.models.finding import Finding
from rawreporter.schemas.evidence import EvidenceRead
from rawreporter.services import audit_service
from rawreporter.utils.enums import AuditActionEnum, FileTypeEnum

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("", response_model=list[EvidenceRead])
async def list_evidence(
    finding_id: UUID,
    _: User = Depends(require_permission("evidence", "view")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Evidence)
        .where(Evidence.finding_id == finding_id)
        .order_by(Evidence.created_at)
    )
    return result.scalars().all()


@router.post("", response_model=EvidenceRead, status_code=status.HTTP_201_CREATED)
async def upload_evidence(
    finding_id: UUID = Form(...),
    file_type: FileTypeEnum = Form(...),
    caption: str | None = Form(None),
    file: UploadFile = File(...),
    _: User = Depends(require_permission("evidence", "upload")),
    db: AsyncSession = Depends(get_db),
):
    finding = await db.get(Finding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    settings = get_settings()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit",
        )

    dest_dir = os.path.join(settings.UPLOAD_DIR, str(finding_id))
    os.makedirs(dest_dir, exist_ok=True)
    safe_name = os.path.basename(file.filename or "upload")
    file_path = os.path.join(dest_dir, safe_name)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    evidence = Evidence(
        finding_id=finding_id,
        file_type=file_type,
        filename=safe_name,
        file_path=file_path,
        caption=caption,
    )
    db.add(evidence)
    await db.commit()
    await db.refresh(evidence)
    return evidence


@router.get("/{evidence_id}", response_model=EvidenceRead)
async def get_evidence(
    evidence_id: UUID,
    _: User = Depends(require_permission("evidence", "view")),
    db: AsyncSession = Depends(get_db),
):
    evidence = await db.get(Evidence, evidence_id)
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evidence


@router.delete("/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evidence(
    evidence_id: UUID,
    request: Request,
    current_user: User = Depends(require_permission("evidence", "delete")),
    db: AsyncSession = Depends(get_db),
):
    evidence = await db.get(Evidence, evidence_id)
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    filename = evidence.filename
    if os.path.exists(evidence.file_path):
        os.remove(evidence.file_path)
    await db.delete(evidence)
    await audit_service.log_event(
        session=db,
        action=AuditActionEnum.evidence_deleted,
        resource_type="evidence",
        user_id=current_user.id,
        resource_id=evidence_id,
        resource_name=filename,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
