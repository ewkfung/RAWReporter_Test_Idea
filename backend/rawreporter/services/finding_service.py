from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.models.finding import Finding
from rawreporter.models.report_section import ReportSection
from rawreporter.utils.enums import SeverityEnum


async def _resolve_section(
    report_id: UUID, severity: SeverityEnum, session: AsyncSession
) -> ReportSection | None:
    result = await session.execute(
        select(ReportSection).where(
            ReportSection.report_id == report_id,
            ReportSection.severity_filter == severity,
        )
    )
    return result.scalar_one_or_none()


async def _next_position(section_id: UUID, session: AsyncSession) -> int:
    result = await session.execute(
        select(func.max(Finding.position)).where(Finding.section_id == section_id)
    )
    max_pos = result.scalar_one_or_none()
    return (max_pos + 1) if max_pos is not None else 1


async def update_finding_severity(
    finding_id: UUID,
    new_severity: SeverityEnum,
    session: AsyncSession,
) -> Finding:
    finding = await session.get(Finding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    finding.severity_override = new_severity  # @validates syncs severity_effective

    correct_section = await _resolve_section(finding.report_id, new_severity, session)

    if correct_section and correct_section.id != finding.section_id:
        finding.section_id = correct_section.id
        finding.position = await _next_position(correct_section.id, session)

    finding.is_placement_override = False

    await session.flush()
    await session.refresh(finding)
    return finding


async def move_finding_to_section(
    finding_id: UUID,
    target_section_id: UUID,
    new_position: int,
    session: AsyncSession,
) -> Finding:
    finding = await session.get(Finding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    target_section = await session.get(ReportSection, target_section_id)
    if not target_section:
        raise HTTPException(status_code=404, detail="Section not found")

    severity_effective = (
        finding.severity_override if finding.severity_override else finding.severity_default
    )

    if target_section.severity_filter == severity_effective:
        finding.is_placement_override = False
        finding.override_justification = None
    else:
        finding.is_placement_override = True
        # override_justification left unchanged — consultant must fill it in

    # Shift existing findings in target section to make room
    existing_result = await session.execute(
        select(Finding).where(
            Finding.section_id == target_section_id,
            Finding.position >= new_position,
            Finding.id != finding_id,
        )
    )
    for f in existing_result.scalars().all():
        f.position += 1

    finding.section_id = target_section_id
    finding.position = new_position

    await session.flush()
    await session.refresh(finding)
    return finding


async def reorder_finding(
    finding_id: UUID,
    new_position: int,
    session: AsyncSession,
) -> Finding:
    finding = await session.get(Finding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    old_position = finding.position
    section_id = finding.section_id

    if new_position == old_position:
        return finding

    if new_position < old_position:
        # Moving up: shift findings between new_position and old_position-1 down by 1
        shift_result = await session.execute(
            select(Finding).where(
                Finding.section_id == section_id,
                Finding.position >= new_position,
                Finding.position < old_position,
                Finding.id != finding_id,
            )
        )
        for f in shift_result.scalars().all():
            f.position += 1
    else:
        # Moving down: shift findings between old_position+1 and new_position up by 1
        shift_result = await session.execute(
            select(Finding).where(
                Finding.section_id == section_id,
                Finding.position > old_position,
                Finding.position <= new_position,
                Finding.id != finding_id,
            )
        )
        for f in shift_result.scalars().all():
            f.position -= 1

    finding.position = new_position

    await session.flush()
    await session.refresh(finding)
    return finding
