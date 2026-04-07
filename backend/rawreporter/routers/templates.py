from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.database import get_db
from rawreporter.dependencies import require_permission
from rawreporter.models.report_default_template import ReportDefaultTemplate
from rawreporter.services.report_service import SECTION_STRUCTURES
from rawreporter.utils.enums import EngagementTypeEnum, SectionTypeEnum

router = APIRouter(prefix="/templates", tags=["templates"])


class TemplateEntryRead(BaseModel):
    engagement_type: str
    section_type: str
    title: str
    default_body: str | None
    updated_at: datetime | None = None


class TemplateUpsertPayload(BaseModel):
    default_body: str | None = None


@router.get("", response_model=dict[str, list[TemplateEntryRead]])
async def list_all_templates(
    _: User = Depends(require_permission("report_default_template", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Returns default templates grouped by engagement_type."""
    result = await db.execute(select(ReportDefaultTemplate))
    rows = result.scalars().all()
    by_type: dict[str, list[TemplateEntryRead]] = {}
    for row in rows:
        entry = TemplateEntryRead(
            engagement_type=row.engagement_type,
            section_type=row.section_type.value,
            title=row.section_type.value.replace("_", " ").title(),
            default_body=row.default_body,
            updated_at=row.updated_at,
        )
        by_type.setdefault(row.engagement_type, []).append(entry)
    return by_type


@router.get("/{engagement_type}", response_model=list[TemplateEntryRead])
async def get_templates_for_type(
    engagement_type: str,
    _: User = Depends(require_permission("report_default_template", "view")),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the full ordered section list for one engagement type with their
    current default_body values (null for sections that have no saved template).
    """
    try:
        eng_type = EngagementTypeEnum(engagement_type)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown engagement type: {engagement_type}")

    structure = SECTION_STRUCTURES.get(eng_type)
    if structure is None:
        raise HTTPException(
            status_code=422,
            detail=f"Engagement type '{engagement_type}' has no report builder.",
        )

    # Fetch saved templates for this engagement type
    result = await db.execute(
        select(ReportDefaultTemplate).where(
            ReportDefaultTemplate.engagement_type == engagement_type
        )
    )
    saved = {t.section_type: t for t in result.scalars().all()}

    entries: list[TemplateEntryRead] = []
    seen_findings = False

    for pos, stype, title, _ in structure:
        row = saved.get(stype)
        entries.append(
            TemplateEntryRead(
                engagement_type=engagement_type,
                section_type=stype.value,
                title=title,
                default_body=row.default_body if row else None,
                updated_at=row.updated_at if row else None,
            )
        )
        # After the findings container, include severity sub-section templates
        if stype == SectionTypeEnum.findings and not seen_findings:
            seen_findings = True
            from rawreporter.services.report_service import _SEVERITY_SUB_SECTIONS
            from rawreporter.utils.enums import SectionTypeEnum as ST
            for sub_type, sub_title, _, _ in _SEVERITY_SUB_SECTIONS:
                sub_row = saved.get(sub_type)
                entries.append(
                    TemplateEntryRead(
                        engagement_type=engagement_type,
                        section_type=sub_type.value,
                        title=sub_title,
                        default_body=sub_row.default_body if sub_row else None,
                        updated_at=sub_row.updated_at if sub_row else None,
                    )
                )

    return entries


@router.put("/{engagement_type}/{section_type}", response_model=TemplateEntryRead)
async def upsert_template(
    engagement_type: str,
    section_type: str,
    payload: TemplateUpsertPayload,
    current_user: User = Depends(require_permission("report_default_template", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates or updates the default body for a specific section in a builder.
    Idempotent — safe to call repeatedly.
    """
    try:
        EngagementTypeEnum(engagement_type)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown engagement type: {engagement_type}")

    try:
        stype = SectionTypeEnum(section_type)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown section type: {section_type}")

    result = await db.execute(
        select(ReportDefaultTemplate).where(
            ReportDefaultTemplate.engagement_type == engagement_type,
            ReportDefaultTemplate.section_type == stype,
        )
    )
    template = result.scalar_one_or_none()

    if template is None:
        template = ReportDefaultTemplate(
            engagement_type=engagement_type,
            section_type=stype,
            default_body=payload.default_body,
            updated_by=current_user.id,
        )
        db.add(template)
    else:
        template.default_body = payload.default_body
        template.updated_by = current_user.id
        template.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(template)

    return TemplateEntryRead(
        engagement_type=template.engagement_type,
        section_type=template.section_type.value,
        title=stype.value.replace("_", " ").title(),
        default_body=template.default_body,
        updated_at=template.updated_at,
    )
