from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from rawreporter.models.engagement import Engagement
from rawreporter.models.finding import Finding
from rawreporter.models.finding_reference import FindingReference
from rawreporter.models.platform_setting import PlatformSetting
from rawreporter.models.report import Report
from rawreporter.models.report_section import ReportSection
from rawreporter.utils.enums import EngagementTypeEnum, SeverityEnum

ENGAGEMENT_TYPE_DISPLAY = {
    EngagementTypeEnum.vulnerability_assessment: "Vulnerability Assessment",
    EngagementTypeEnum.pentest: "Penetration Testing",
    EngagementTypeEnum.risk: "Risk Assessment",
    EngagementTypeEnum.compliance_assessment: "Compliance Assessment",
    EngagementTypeEnum.gap_assessment: "Security Gap Assessment",
    EngagementTypeEnum.tabletop: "Tabletop Exercise",
    EngagementTypeEnum.tsa_directive: "TSA Directive Assessment",
}

SEVERITY_ORDER = [
    SeverityEnum.critical,
    SeverityEnum.high,
    SeverityEnum.medium,
    SeverityEnum.low,
    SeverityEnum.informational,
]

REF_TYPE_ENABLED_FIELD = {
    "cve": "ref_cve_enabled",
    "cwe": "ref_cwe_enabled",
    "cisa": "ref_cisa_enabled",
    "nist": "ref_nist_enabled",
    "nvd": "ref_nvd_enabled",
    "manufacturer": "ref_manufacturer_enabled",
}


async def build_report_context(report_id: UUID, session: AsyncSession) -> dict:
    """Build the full template context dict for report generation."""

    # Fetch report with sections
    result = await session.execute(
        select(Report)
        .where(Report.id == report_id)
        .options(
            selectinload(Report.sections),
            selectinload(Report.engagement).selectinload(Engagement.client),
        )
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    # Fetch all findings for the report with their references
    findings_result = await session.execute(
        select(Finding)
        .where(Finding.report_id == report_id)
        .options(selectinload(Finding.references))
        .order_by(Finding.position)
    )
    all_findings = findings_result.scalars().all()

    # Fetch platform settings
    settings_result = await session.execute(select(PlatformSetting))
    settings = {row.key: row.value for row in settings_result.scalars().all()}
    firm_name = settings.get("firm_name")

    # Build engagement context
    engagement_ctx: dict = {}
    client_ctx: dict = {}
    if report.engagement is not None:
        eng = report.engagement
        eng_types: list = eng.types or []
        eng_type_str: str = eng_types[0] if eng_types else ""
        try:
            eng_type_enum = EngagementTypeEnum(eng_type_str)
            type_display = ENGAGEMENT_TYPE_DISPLAY.get(eng_type_enum, eng_type_str)
        except ValueError:
            type_display = eng_type_str

        # Resolve lead consultant name
        lead_name: str | None = None
        if eng.engagement_lead_id is not None:
            from rawreporter.auth.models import User
            lead_user = await session.get(User, eng.engagement_lead_id)
            if lead_user is not None:
                lead_name = f"{lead_user.first_name} {lead_user.last_name}".strip() or lead_user.username

        engagement_ctx = {
            "title": eng.title,
            "type": eng_type_str,
            "type_display": type_display,
            "start_date": eng.start_date.isoformat() if eng.start_date else None,
            "end_date": eng.end_date.isoformat() if eng.end_date else None,
            "completed_date": eng.completed_date.isoformat() if eng.completed_date else None,
            "lead_consultant": lead_name,
            "scope_description": eng.scope_description,
        }

        # Build client context
        if eng.client is not None:
            client = eng.client
            client_ctx = {
                "name": client.name,
                "industry": client.industry_vertical or None,
                "vertical": client.industry_vertical or None,
                "primary_contact": client.primary_contact or None,
                "contact_email": client.contact_email or None,
            }
        else:
            client_ctx = {
                "name": "",
                "industry": None,
                "vertical": None,
                "primary_contact": None,
                "contact_email": None,
            }
    else:
        # No engagement — use report types for type info
        report_types: list = report.types or []
        eng_type_str = report_types[0] if report_types else ""
        try:
            eng_type_enum = EngagementTypeEnum(eng_type_str)
            type_display = ENGAGEMENT_TYPE_DISPLAY.get(eng_type_enum, eng_type_str)
        except ValueError:
            type_display = eng_type_str

        engagement_ctx = {
            "title": "",
            "type": eng_type_str,
            "type_display": type_display,
            "start_date": None,
            "end_date": None,
            "completed_date": None,
            "lead_consultant": None,
            "scope_description": None,
        }
        client_ctx = {
            "name": "",
            "industry": None,
            "vertical": None,
            "primary_contact": None,
            "contact_email": None,
        }

    # Build sections list — visible only, ordered by position.
    # Skip severity sub-sections (severity_filter is not None) — they are
    # rendered inside render_findings_section, not as standalone sections.
    sections_ctx = []
    for section in sorted(report.sections, key=lambda s: s.position):
        if not section.is_visible:
            continue
        if section.severity_filter is not None:
            continue
        is_findings = section.section_type.value == "findings"
        sections_ctx.append({
            "position": section.position,
            "section_type": section.section_type.value,
            "title": section.title or section.section_type.value.replace("_", " ").title(),
            "body_text": section.body_text,
            "is_findings_section": is_findings,
        })

    # Build findings summary and by-severity dicts
    findings_summary = {s.value: 0 for s in SEVERITY_ORDER}
    findings_by_severity: dict[str, list[dict]] = {}

    for finding in all_findings:
        sev = finding.severity_effective.value
        findings_summary[sev] = findings_summary.get(sev, 0) + 1

        finding_dict = _build_finding_dict(finding)
        findings_by_severity.setdefault(sev, []).append(finding_dict)

    findings_summary["total"] = sum(findings_summary[s.value] for s in SEVERITY_ORDER)

    # Only keep severities with findings in the by-severity dict (already handled by setdefault)
    # Ensure ordering within each severity group is by position (already ordered by query)

    return {
        "report": {
            "id": str(report.id),
            "title": report.title,
            "status": report.status.value,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "engagement": engagement_ctx,
        "client": client_ctx,
        "firm_name": firm_name,
        "sections": sections_ctx,
        "findings_summary": findings_summary,
        "findings_by_severity": findings_by_severity,
    }


def _build_finding_dict(finding: Finding) -> dict:
    """Build the context dict for a single finding."""
    # Effective CVSS score
    cvss_score = finding.cvss_score_override if finding.cvss_score_override is not None else finding.cvss_score_default

    # Build references dict — only enabled types with entries
    ref_data: dict[str, dict] = {}
    for ref_type, enabled_field in REF_TYPE_ENABLED_FIELD.items():
        is_enabled = getattr(finding, enabled_field, False)
        entries = [
            {"value": ref.identifier, "url": ref.url}
            for ref in finding.references
            if ref.ref_type.value == ref_type and ref.is_visible
        ]
        ref_data[ref_type] = {
            "enabled": is_enabled,
            "entries": entries if is_enabled else [],
        }

    return {
        "title": finding.title,
        "severity": finding.severity_effective.value,
        "summary": finding.summary or None,
        "observation": finding.observation or None,
        "recommendation": finding.recommendation or None,
        "remediation_steps": finding.remediation_steps if finding.remediation_steps_enabled else None,
        "remediation_steps_enabled": finding.remediation_steps_enabled,
        "cvss_score": cvss_score,
        "cvss_vector": None,  # not stored in current schema
        "affected_systems": None,  # not stored in current schema
        "is_placement_override": finding.is_placement_override,
        "override_justification": finding.override_justification,
        "references": ref_data,
    }
