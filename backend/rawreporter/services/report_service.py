from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.models.finding import Finding
from rawreporter.models.report_default_template import ReportDefaultTemplate
from rawreporter.models.report_section import ReportSection
from rawreporter.utils.enums import EngagementTypeEnum, SectionTypeEnum, SeverityEnum


# ── Severity sub-sections seeded inside every findings block ───────────────
# Tuple: (section_type, title, severity_filter, is_visible)
_SEVERITY_SUB_SECTIONS = [
    (SectionTypeEnum.critical_findings,  "Critical Findings",  SeverityEnum.critical,      True),
    (SectionTypeEnum.high_findings,      "High Findings",      SeverityEnum.high,           True),
    (SectionTypeEnum.medium_findings,    "Medium Findings",    SeverityEnum.medium,         True),
    (SectionTypeEnum.low_findings,       "Low Findings",       SeverityEnum.low,            True),
    (SectionTypeEnum.informational,      "Informational",      SeverityEnum.informational,  True),
]


# ── Per-builder section structures ─────────────────────────────────────────
# Tuple: (position, section_type, title, is_visible)
# When section_type is SectionTypeEnum.findings, the seeder also inserts the
# five severity sub-sections at positions (pos+1) through (pos+5).
# Sections listed after the findings block must use positions ≥ pos+6.

SECTION_STRUCTURES: dict[EngagementTypeEnum, list[tuple]] = {

    EngagementTypeEnum.vulnerability_assessment: [
        (1,  SectionTypeEnum.report_title,          "Report Title",            True),
        (2,  SectionTypeEnum.executive_summary,      "Executive Summary",       True),
        (3,  SectionTypeEnum.crown_jewel,            "Crown Jewel Analysis",    True),
        (4,  SectionTypeEnum.scope_and_methodology,  "Scope and Methodology",   True),
        (5,  SectionTypeEnum.findings_summary,       "Findings Summary",        True),
        (6,  SectionTypeEnum.findings,               "Findings",                True),  # → seeds 7-11
        (12, SectionTypeEnum.remediation_roadmap,    "Remediation Roadmap",     True),
        (13, SectionTypeEnum.closing,                "Closing",                 True),
        (14, SectionTypeEnum.appendix,               "Appendix",                False),
    ],

    EngagementTypeEnum.pentest: [
        (1,  SectionTypeEnum.report_title,                    "Report Title",                  True),
        (2,  SectionTypeEnum.executive_summary,               "Executive Summary",              True),
        (3,  SectionTypeEnum.scope_and_rules_of_engagement,   "Scope and Rules of Engagement", True),
        (4,  SectionTypeEnum.methodology,                     "Methodology",                   True),
        (5,  SectionTypeEnum.findings_summary,                "Findings Summary",              True),
        (6,  SectionTypeEnum.crown_jewel,                     "Crown Jewel Analysis",          True),
        (7,  SectionTypeEnum.attack_path,                     "Attack Path",                   True),
        (8,  SectionTypeEnum.findings,                        "Findings",                      True),  # → seeds 9-13
        (14, SectionTypeEnum.remediation_roadmap,             "Remediation Roadmap",           True),
        (15, SectionTypeEnum.closing,                         "Closing",                       True),
        (16, SectionTypeEnum.appendix,                        "Appendix",                      False),
    ],

    EngagementTypeEnum.risk: [
        (1,  SectionTypeEnum.report_title,               "Report Title",              True),
        (2,  SectionTypeEnum.executive_summary,           "Executive Summary",         True),
        (3,  SectionTypeEnum.scope_and_methodology,       "Scope and Methodology",     True),
        (4,  SectionTypeEnum.risk_assessment_approach,    "Risk Assessment Approach",  True),
        (5,  SectionTypeEnum.risk_assessment_result,      "Risk Assessment Results",   True),
        (6,  SectionTypeEnum.findings,                    "Findings",                  True),  # → seeds 7-11
        (12, SectionTypeEnum.remediation_roadmap,         "Remediation Roadmap",       True),
        (13, SectionTypeEnum.closing,                     "Closing",                   True),
        (14, SectionTypeEnum.appendix,                    "Appendix",                  False),
    ],

    EngagementTypeEnum.compliance_assessment: [
        (1,  SectionTypeEnum.report_title,                    "Report Title",                    True),
        (2,  SectionTypeEnum.executive_summary,               "Executive Summary",                True),
        (3,  SectionTypeEnum.compliance_framework_overview,   "Compliance Framework Overview",   True),
        (4,  SectionTypeEnum.scope_and_methodology,           "Scope and Methodology",            True),
        (5,  SectionTypeEnum.compliance_maturity,             "Compliance Maturity",              True),
        (6,  SectionTypeEnum.findings,                        "Findings",                         True),  # → seeds 7-11
        (12, SectionTypeEnum.remediation_roadmap,             "Remediation Roadmap",              True),
        (13, SectionTypeEnum.closing,                         "Closing",                          True),
        (14, SectionTypeEnum.appendix,                        "Appendix",                         False),
    ],

    EngagementTypeEnum.gap_assessment: [
        (1,  SectionTypeEnum.report_title,          "Report Title",         True),
        (2,  SectionTypeEnum.executive_summary,      "Executive Summary",    True),
        (3,  SectionTypeEnum.scope_and_methodology,  "Scope and Methodology", True),
        (4,  SectionTypeEnum.gap_analysis,           "Gap Analysis",         True),
        (5,  SectionTypeEnum.findings_summary,       "Findings Summary",     True),
        (6,  SectionTypeEnum.findings,               "Findings",             True),  # → seeds 7-11
        (12, SectionTypeEnum.remediation_roadmap,    "Remediation Roadmap",  True),
        (13, SectionTypeEnum.closing,                "Closing",              True),
        (14, SectionTypeEnum.appendix,               "Appendix",             False),
    ],
}


async def seed_report_sections(
    report_id: UUID,
    engagement_type: EngagementTypeEnum,
    session: AsyncSession,
) -> list[ReportSection]:
    """
    Seeds sections for a new report based on the engagement type's builder structure.
    Raises HTTP 422 if the engagement type has no defined builder
    (e.g. tabletop, tsa_directive).
    """
    structure = SECTION_STRUCTURES.get(engagement_type)
    if structure is None:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Engagement type '{engagement_type.value}' does not have a "
                "report builder. Reports cannot be created for this engagement type."
            ),
        )

    # Pre-fetch all default templates for this engagement type in one query
    result = await session.execute(
        select(ReportDefaultTemplate).where(
            ReportDefaultTemplate.engagement_type == engagement_type.value
        )
    )
    templates = {t.section_type: t.default_body for t in result.scalars().all()}

    sections: list[ReportSection] = []

    for pos, stype, title, is_visible in structure:
        body = templates.get(stype)
        section = ReportSection(
            report_id=report_id,
            section_type=stype,
            severity_filter=None,
            title=title,
            position=pos,
            is_visible=is_visible,
            body_text=body,
        )
        sections.append(section)

        # Findings block: also seed the five severity sub-sections
        if stype == SectionTypeEnum.findings:
            for i, (sub_type, sub_title, sev_filter, sub_visible) in enumerate(
                _SEVERITY_SUB_SECTIONS, start=1
            ):
                sub_body = templates.get(sub_type)
                sections.append(
                    ReportSection(
                        report_id=report_id,
                        section_type=sub_type,
                        severity_filter=sev_filter,
                        title=sub_title,
                        position=pos + i,
                        is_visible=sub_visible,
                        body_text=sub_body,
                    )
                )

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
