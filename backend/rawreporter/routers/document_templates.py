import os
import zipfile
from datetime import datetime, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.database import get_db
from rawreporter.dependencies import require_permission
from rawreporter.models.document_template import DocumentTemplate
from rawreporter.utils.enums import EngagementTypeEnum

router = APIRouter(prefix="/document-templates", tags=["document-templates"])

TEMPLATE_DIR = "uploads/doc_templates"
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

ENGAGEMENT_DISPLAY_NAMES = {
    EngagementTypeEnum.vulnerability_assessment: "Vulnerability Assessment",
    EngagementTypeEnum.pentest: "Penetration Testing",
    EngagementTypeEnum.risk: "Risk Assessment",
    EngagementTypeEnum.compliance_assessment: "Compliance Assessment",
    EngagementTypeEnum.gap_assessment: "Security Gap Assessment",
}

# Only the 5 builder-supported types
BUILDER_TYPES = [
    EngagementTypeEnum.vulnerability_assessment,
    EngagementTypeEnum.pentest,
    EngagementTypeEnum.risk,
    EngagementTypeEnum.compliance_assessment,
    EngagementTypeEnum.gap_assessment,
]


class DocumentTemplateInfo(BaseModel):
    id: str
    original_filename: str
    file_size_bytes: int
    uploaded_at: datetime
    uploaded_by_name: str | None


class DocumentTemplateStatus(BaseModel):
    engagement_type: str
    display_name: str
    template: DocumentTemplateInfo | None


@router.get("/", response_model=list[DocumentTemplateStatus])
async def list_document_templates(
    _: User = Depends(require_permission("document_template", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Returns upload status for all 5 builder engagement types."""
    result = await db.execute(select(DocumentTemplate))
    rows = {r.engagement_type: r for r in result.scalars().all()}

    response: list[DocumentTemplateStatus] = []
    for eng_type in BUILDER_TYPES:
        row = rows.get(eng_type)
        template_info: DocumentTemplateInfo | None = None
        if row is not None:
            uploader_name: str | None = None
            if row.uploaded_by is not None:
                from rawreporter.auth.models import User as UserModel
                user_result = await db.get(UserModel, row.uploaded_by)
                if user_result is not None:
                    uploader_name = f"{user_result.first_name} {user_result.last_name}".strip() or user_result.username
            template_info = DocumentTemplateInfo(
                id=str(row.id),
                original_filename=row.original_filename,
                file_size_bytes=row.file_size_bytes,
                uploaded_at=row.updated_at,
                uploaded_by_name=uploader_name,
            )
        response.append(DocumentTemplateStatus(
            engagement_type=eng_type.value,
            display_name=ENGAGEMENT_DISPLAY_NAMES[eng_type],
            template=template_info,
        ))
    return response


@router.post("/{engagement_type}", response_model=DocumentTemplateStatus)
async def upload_document_template(
    engagement_type: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("document_template", "upload")),
    db: AsyncSession = Depends(get_db),
):
    """Upload a .docx base template for a specific engagement type."""
    try:
        eng_type = EngagementTypeEnum(engagement_type)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown engagement type: {engagement_type}")

    if eng_type not in BUILDER_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Engagement type '{engagement_type}' does not have a report builder.",
        )

    # Validate extension
    filename = file.filename or ""
    if not filename.lower().endswith(".docx"):
        raise HTTPException(status_code=422, detail="File must be a .docx file.")

    content = await file.read()

    # Validate size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=422, detail="File must be 20 MB or smaller.")

    # Validate it's a valid ZIP (DOCX = ZIP)
    if not zipfile.is_zipfile(BytesIO(content)):
        raise HTTPException(status_code=422, detail="File is not a valid .docx document.")

    # Save to disk
    os.makedirs(TEMPLATE_DIR, exist_ok=True)
    file_path = os.path.join(TEMPLATE_DIR, f"{engagement_type}.docx")
    with open(file_path, "wb") as f:
        f.write(content)

    # Upsert DB row
    result = await db.execute(
        select(DocumentTemplate).where(DocumentTemplate.engagement_type == eng_type)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = DocumentTemplate(
            engagement_type=eng_type,
            original_filename=filename,
            file_path=file_path,
            file_size_bytes=len(content),
            uploaded_by=current_user.id,
            is_valid=True,
        )
        db.add(row)
    else:
        row.original_filename = filename
        row.file_path = file_path
        row.file_size_bytes = len(content)
        row.uploaded_by = current_user.id
        row.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(row)

    uploader_name = f"{current_user.first_name} {current_user.last_name}".strip() or current_user.username
    return DocumentTemplateStatus(
        engagement_type=eng_type.value,
        display_name=ENGAGEMENT_DISPLAY_NAMES[eng_type],
        template=DocumentTemplateInfo(
            id=str(row.id),
            original_filename=row.original_filename,
            file_size_bytes=row.file_size_bytes,
            uploaded_at=row.updated_at,
            uploaded_by_name=uploader_name,
        ),
    )


@router.delete("/{engagement_type}", status_code=204)
async def delete_document_template(
    engagement_type: str,
    _: User = Depends(require_permission("document_template", "delete")),
    db: AsyncSession = Depends(get_db),
):
    """Delete the uploaded template for a specific engagement type."""
    try:
        eng_type = EngagementTypeEnum(engagement_type)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown engagement type: {engagement_type}")

    result = await db.execute(
        select(DocumentTemplate).where(DocumentTemplate.engagement_type == eng_type)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="No template uploaded for this engagement type.")

    # Delete from disk
    if os.path.exists(row.file_path):
        os.remove(row.file_path)

    await db.delete(row)
    await db.commit()
