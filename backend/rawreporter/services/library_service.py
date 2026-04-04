from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.models.finding import Finding
from rawreporter.models.finding_reference import FindingReference
from rawreporter.models.library_finding import LibraryFinding
from rawreporter.models.library_finding_reference import LibraryFindingReference
from rawreporter.models.report import Report
from rawreporter.models.report_section import ReportSection
from rawreporter.utils.enums import SeverityEnum


async def copy_library_finding_to_report(
    library_finding_id: UUID,
    report_id: UUID,
    session: AsyncSession,
    target_section_id: UUID | None = None,
) -> Finding:
    library_finding = await session.get(LibraryFinding, library_finding_id)
    if not library_finding:
        raise HTTPException(status_code=404, detail="Library finding not found")

    report = await session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    severity_effective = library_finding.severity

    if target_section_id is not None:
        section = await session.get(ReportSection, target_section_id)
        if section is None or section.report_id != report_id:
            raise HTTPException(status_code=404, detail="Target section not found in report")
        is_placement_override = (
            section.severity_filter is not None
            and section.severity_filter != severity_effective
        )
    else:
        section_result = await session.execute(
            select(ReportSection).where(
                ReportSection.report_id == report_id,
                ReportSection.severity_filter == severity_effective,
            )
        )
        section = section_result.scalar_one_or_none()
        if section is None:
            raise HTTPException(
                status_code=422,
                detail=f"No section with severity_filter='{severity_effective}' found in report",
            )
        is_placement_override = False

    pos_result = await session.execute(
        select(func.max(Finding.position)).where(Finding.section_id == section.id)
    )
    max_pos = pos_result.scalar_one_or_none()
    position = (max_pos + 1) if max_pos is not None else 1

    finding = Finding(
        report_id=report_id,
        section_id=section.id,
        library_finding_id=library_finding.id,
        title=library_finding.title,
        summary=library_finding.summary,
        observation=library_finding.observation,
        description_technical=library_finding.description_technical,
        description_executive=library_finding.description_executive,
        severity_default=library_finding.severity,
        severity_override=None,
        cvss_score_default=library_finding.cvss_score_default,
        recommendation=library_finding.recommendation,
        remediation_steps=library_finding.remediation_steps,
        remediation_steps_enabled=library_finding.remediation_steps_enabled,
        is_placement_override=is_placement_override,
        override_justification=None,
        position=position,
        is_ot_specific=library_finding.is_ot_specific,
        ref_cve_enabled=library_finding.ref_cve_enabled,
        ref_cwe_enabled=library_finding.ref_cwe_enabled,
        ref_cisa_enabled=library_finding.ref_cisa_enabled,
        ref_nist_enabled=library_finding.ref_nist_enabled,
        ref_nvd_enabled=library_finding.ref_nvd_enabled,
        ref_manufacturer_enabled=library_finding.ref_manufacturer_enabled,
    )
    session.add(finding)
    await session.flush()  # populate finding.id before copying references

    lib_refs_result = await session.execute(
        select(LibraryFindingReference).where(
            LibraryFindingReference.library_finding_id == library_finding.id
        )
    )
    for lib_ref in lib_refs_result.scalars().all():
        session.add(
            FindingReference(
                finding_id=finding.id,
                ref_type=lib_ref.ref_type,
                identifier=lib_ref.identifier,
                url=lib_ref.url,
                description=lib_ref.description,
                is_visible=lib_ref.is_visible,
            )
        )

    await session.flush()
    await session.refresh(finding)
    return finding


async def get_library_findings(
    session: AsyncSession,
    vertical: str | None = None,
    severity: SeverityEnum | None = None,
    is_ot_specific: bool | None = None,
    search: str | None = None,
) -> list[LibraryFinding]:
    stmt = select(LibraryFinding).where(LibraryFinding.is_archived == False)  # noqa: E712
    if vertical is not None:
        stmt = stmt.where(LibraryFinding.vertical == vertical)
    if severity is not None:
        stmt = stmt.where(LibraryFinding.severity == severity)
    if is_ot_specific is not None:
        stmt = stmt.where(LibraryFinding.is_ot_specific == is_ot_specific)
    if search is not None:
        stmt = stmt.where(
            LibraryFinding.title.ilike(f"%{search}%")
            | LibraryFinding.summary.ilike(f"%{search}%")
        )
    stmt = stmt.order_by(LibraryFinding.severity, LibraryFinding.title)
    result = await session.execute(stmt)
    return result.scalars().all()
