from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.database import get_db
from rawreporter.dependencies import require_permission
from rawreporter.models.report_section import ReportSection
from rawreporter.schemas.report_section import ReportSectionRead, ReportSectionUpdate

router = APIRouter(prefix="/sections", tags=["sections"])


@router.get("", response_model=list[ReportSectionRead])
async def list_sections(
    report_id: UUID,
    _: User = Depends(require_permission("report", "view")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReportSection)
        .where(ReportSection.report_id == report_id)
        .order_by(ReportSection.position)
    )
    return result.scalars().all()


@router.get("/{section_id}", response_model=ReportSectionRead)
async def get_section(
    section_id: UUID,
    _: User = Depends(require_permission("report", "view")),
    db: AsyncSession = Depends(get_db),
):
    section = await db.get(ReportSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return section


@router.patch("/{section_id}", response_model=ReportSectionRead)
async def update_section(
    section_id: UUID,
    payload: ReportSectionUpdate,
    _: User = Depends(require_permission("report", "edit")),
    db: AsyncSession = Depends(get_db),
):
    section = await db.get(ReportSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(section, field, value)
    await db.commit()
    await db.refresh(section)
    return section
