from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.models.finding import Finding
from rawreporter.models.report_section import ReportSection
from rawreporter.utils.enums import SectionTypeEnum, SeverityEnum


_SECTION_SEED = [
    (1,  SectionTypeEnum.executive_summary,  None,                       True),
    (2,  SectionTypeEnum.findings_summary,   None,                       True),
    (3,  SectionTypeEnum.crown_jewel,        None,                       True),
    (4,  SectionTypeEnum.critical_findings,  SeverityEnum.critical,      True),
    (5,  SectionTypeEnum.high_findings,      SeverityEnum.high,          True),
    (6,  SectionTypeEnum.medium_findings,    SeverityEnum.medium,        True),
    (7,  SectionTypeEnum.low_findings,       SeverityEnum.low,           True),
    (8,  SectionTypeEnum.informational,      SeverityEnum.informational, True),
    (9,  SectionTypeEnum.closing,            None,                       True),
    (10, SectionTypeEnum.appendix,           None,                       False),
]


async def seed_report_sections(
    report_id: UUID, session: AsyncSession
) -> list[ReportSection]:
    sections = [
        ReportSection(
            report_id=report_id,
            section_type=stype,
            severity_filter=sev_filter,
            title=stype.value.replace("_", " ").title(),
            position=pos,
            is_visible=visible,
        )
        for pos, stype, sev_filter, visible in _SECTION_SEED
    ]
    session.add_all(sections)
    await session.flush()
    return sections


async def validate_report_for_generation(
    report_id: UUID, session: AsyncSession
) -> None:
    result = await session.execute(
        select(Finding, ReportSection)
        .join(ReportSection, Finding.section_id == ReportSection.id)
        .where(
            ReportSection.report_id == report_id,
            Finding.is_placement_override == True,  # noqa: E712
        )
    )
    rows = result.all()

    blocking = [
        {
            "id": str(f.id),
            "title": f.title,
            "section": s.title or s.section_type.value,
        }
        for f, s in rows
        if not f.override_justification
    ]

    if blocking:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": (
                    "Report cannot be generated. The following findings "
                    "have placement overrides without justification."
                ),
                "blocking_findings": blocking,
            },
        )
