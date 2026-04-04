"""
Phase 3 service-layer tests.
Each test sets up its own fixtures within the rolled-back session.
"""
import pytest
from fastapi import HTTPException
from sqlalchemy import select

from rawreporter.models.client import Client
from rawreporter.models.engagement import Engagement
from rawreporter.models.finding import Finding
from rawreporter.models.finding_reference import FindingReference
from rawreporter.models.library_finding import LibraryFinding
from rawreporter.models.library_finding_reference import LibraryFindingReference
from rawreporter.models.report import Report
from rawreporter.models.report_section import ReportSection
from rawreporter.utils.enums import (
    AudienceEnum,
    EngagementStatusEnum,
    EngagementTypeEnum,
    RefTypeEnum,
    ReportStatusEnum,
    SectionTypeEnum,
    SeverityEnum,
)


# ─────────────────────────────────────────────
# Shared fixture helpers
# ─────────────────────────────────────────────

async def _make_report(session) -> tuple[Report, dict[SeverityEnum, ReportSection]]:
    """Create a client → engagement → report + all 10 seeded sections."""
    client = Client(name="Test Corp", industry="Energy", vertical="Oil & Gas")
    session.add(client)
    await session.flush()

    engagement = Engagement(
        client_id=client.id,
        title="OT Assessment",
        type=EngagementTypeEnum.pentest,
        status=EngagementStatusEnum.active,
        engagement_lead="Lead",
    )
    session.add(engagement)
    await session.flush()

    report = Report(
        engagement_id=engagement.id,
        title="Test Report",
        audience=AudienceEnum.technical,
        status=ReportStatusEnum.draft,
    )
    session.add(report)
    await session.flush()

    section_defs = [
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
    sections_by_severity: dict[SeverityEnum, ReportSection] = {}
    for pos, stype, sev_filter, visible in section_defs:
        sec = ReportSection(
            report_id=report.id,
            section_type=stype,
            severity_filter=sev_filter,
            title=stype.value.replace("_", " ").title(),
            position=pos,
            is_visible=visible,
        )
        session.add(sec)
        if sev_filter is not None:
            sections_by_severity[sev_filter] = sec
    await session.flush()

    return report, sections_by_severity


async def _make_library_finding(
    session, severity: SeverityEnum = SeverityEnum.critical
) -> LibraryFinding:
    lib = LibraryFinding(
        title="Default Credentials",
        summary="Factory default credentials in use.",
        description_technical="Tech detail.",
        description_executive="Exec detail.",
        severity=severity,
        recommendation="Change credentials.",
        remediation_steps="1. Log in. 2. Update password.",
        remediation_steps_enabled=True,
        vertical="Oil & Gas",
        tags=["credentials"],
        framework_refs=[],
        questionnaire_trigger=[],
        is_ot_specific=True,
        ref_cve_enabled=True,
        ref_cwe_enabled=False,
        ref_cisa_enabled=False,
        ref_nist_enabled=False,
        ref_nvd_enabled=False,
        ref_manufacturer_enabled=False,
    )
    session.add(lib)
    await session.flush()
    return lib


# ─────────────────────────────────────────────
# Step 1: library_service tests
# ─────────────────────────────────────────────

async def test_library_copy_lands_in_correct_section(session):
    from rawreporter.services.library_service import copy_library_finding_to_report

    report, sections = await _make_report(session)
    lib = await _make_library_finding(session, SeverityEnum.critical)

    # Add a reference to the library finding
    ref = LibraryFindingReference(
        library_finding_id=lib.id,
        ref_type=RefTypeEnum.cve,
        identifier="CVE-2024-1234",
        url="https://nvd.nist.gov/vuln/detail/CVE-2024-1234",
        description="Critical vuln",
        is_visible=True,
    )
    session.add(ref)
    await session.flush()

    finding = await copy_library_finding_to_report(lib.id, report.id, session)

    assert finding.section_id == sections[SeverityEnum.critical].id
    assert finding.severity_default == SeverityEnum.critical
    assert finding.severity_override is None
    assert finding.severity_effective == SeverityEnum.critical
    assert finding.is_placement_override is False
    assert finding.title == lib.title
    assert finding.position == 1

    # Verify reference was copied
    ref_result = await session.execute(
        select(FindingReference).where(FindingReference.finding_id == finding.id)
    )
    copied_refs = ref_result.scalars().all()
    assert len(copied_refs) == 1
    assert copied_refs[0].identifier == "CVE-2024-1234"
    assert copied_refs[0].ref_type == RefTypeEnum.cve


async def test_library_copy_position_increments(session):
    from rawreporter.services.library_service import copy_library_finding_to_report

    report, _ = await _make_report(session)
    lib = await _make_library_finding(session, SeverityEnum.high)

    f1 = await copy_library_finding_to_report(lib.id, report.id, session)
    f2 = await copy_library_finding_to_report(lib.id, report.id, session)

    assert f1.position == 1
    assert f2.position == 2


async def test_library_copy_raises_404_bad_library(session):
    from uuid import uuid4
    from rawreporter.services.library_service import copy_library_finding_to_report

    report, _ = await _make_report(session)

    with pytest.raises(HTTPException) as exc_info:
        await copy_library_finding_to_report(uuid4(), report.id, session)
    assert exc_info.value.status_code == 404


async def test_library_copy_raises_422_no_matching_section(session):
    from rawreporter.services.library_service import copy_library_finding_to_report

    # Report with NO sections
    client = Client(name="NoSec Corp", industry="Energy", vertical="Power")
    session.add(client)
    await session.flush()
    eng = Engagement(
        client_id=client.id, title="E", type=EngagementTypeEnum.pentest,
        status=EngagementStatusEnum.active, engagement_lead="L",
    )
    session.add(eng)
    await session.flush()
    report = Report(
        engagement_id=eng.id, title="Empty", audience=AudienceEnum.technical,
        status=ReportStatusEnum.draft,
    )
    session.add(report)
    await session.flush()

    lib = await _make_library_finding(session, SeverityEnum.critical)

    with pytest.raises(HTTPException) as exc_info:
        await copy_library_finding_to_report(lib.id, report.id, session)
    assert exc_info.value.status_code == 422


async def test_get_library_findings_filters(session):
    from rawreporter.services.library_service import get_library_findings

    lib_ot = LibraryFinding(
        title="OT Finding Alpha", summary="OT specific issue", severity=SeverityEnum.high,
        vertical="Oil & Gas", is_ot_specific=True,
        tags=[], framework_refs=[], questionnaire_trigger=[],
    )
    lib_it = LibraryFinding(
        title="IT Finding Beta", summary="Standard IT issue", severity=SeverityEnum.medium,
        vertical="General", is_ot_specific=False,
        tags=[], framework_refs=[], questionnaire_trigger=[],
    )
    session.add_all([lib_ot, lib_it])
    await session.flush()

    # Filter by is_ot_specific
    results = await get_library_findings(session, is_ot_specific=True)
    ids = {r.id for r in results}
    assert lib_ot.id in ids
    assert lib_it.id not in ids

    # Filter by severity
    results = await get_library_findings(session, severity=SeverityEnum.medium)
    ids = {r.id for r in results}
    assert lib_it.id in ids
    assert lib_ot.id not in ids

    # Search by title
    results = await get_library_findings(session, search="Alpha")
    ids = {r.id for r in results}
    assert lib_ot.id in ids
    assert lib_it.id not in ids

    # Search by summary
    results = await get_library_findings(session, search="Standard IT")
    ids = {r.id for r in results}
    assert lib_it.id in ids


# ─────────────────────────────────────────────
# Step 2: finding_service tests
# ─────────────────────────────────────────────

async def test_severity_change_moves_finding(session):
    from rawreporter.services.finding_service import update_finding_severity
    from rawreporter.services.library_service import copy_library_finding_to_report

    report, sections = await _make_report(session)
    lib = await _make_library_finding(session, SeverityEnum.high)
    finding = await copy_library_finding_to_report(lib.id, report.id, session)

    assert finding.section_id == sections[SeverityEnum.high].id

    updated = await update_finding_severity(finding.id, SeverityEnum.medium, session)

    assert updated.section_id == sections[SeverityEnum.medium].id
    assert updated.severity_override == SeverityEnum.medium
    assert updated.severity_effective == SeverityEnum.medium
    assert updated.is_placement_override is False


async def test_severity_change_no_move_when_same_section(session):
    from rawreporter.services.finding_service import update_finding_severity
    from rawreporter.services.library_service import copy_library_finding_to_report

    report, sections = await _make_report(session)
    lib = await _make_library_finding(session, SeverityEnum.high)
    finding = await copy_library_finding_to_report(lib.id, report.id, session)

    original_section_id = finding.section_id
    # Override to same effective severity — no move expected
    updated = await update_finding_severity(finding.id, SeverityEnum.high, session)

    assert updated.section_id == original_section_id
    assert updated.is_placement_override is False


async def test_manual_move_sets_placement_override(session):
    from rawreporter.services.finding_service import move_finding_to_section
    from rawreporter.services.library_service import copy_library_finding_to_report

    report, sections = await _make_report(session)
    lib = await _make_library_finding(session, SeverityEnum.critical)
    finding = await copy_library_finding_to_report(lib.id, report.id, session)

    assert finding.section_id == sections[SeverityEnum.critical].id

    # Manually move to medium section — severity doesn't match
    moved = await move_finding_to_section(
        finding.id, sections[SeverityEnum.medium].id, 1, session
    )

    assert moved.section_id == sections[SeverityEnum.medium].id
    assert moved.is_placement_override is True
    assert moved.override_justification is None


async def test_manual_move_no_override_when_section_matches(session):
    from rawreporter.services.finding_service import move_finding_to_section
    from rawreporter.services.library_service import copy_library_finding_to_report

    report, sections = await _make_report(session)
    lib = await _make_library_finding(session, SeverityEnum.critical)
    finding = await copy_library_finding_to_report(lib.id, report.id, session)

    # Move to the same-severity section (still critical) — no placement override
    moved = await move_finding_to_section(
        finding.id, sections[SeverityEnum.critical].id, 1, session
    )

    assert moved.is_placement_override is False
    assert moved.override_justification is None


async def test_move_shifts_existing_findings(session):
    from rawreporter.services.finding_service import move_finding_to_section
    from rawreporter.services.library_service import copy_library_finding_to_report

    report, sections = await _make_report(session)
    lib = await _make_library_finding(session, SeverityEnum.high)

    f1 = await copy_library_finding_to_report(lib.id, report.id, session)
    f2 = await copy_library_finding_to_report(lib.id, report.id, session)
    assert f1.position == 1
    assert f2.position == 2

    # Import a critical finding then move it to position 1 in the high section
    lib_crit = await _make_library_finding(session, SeverityEnum.critical)
    f_crit = await copy_library_finding_to_report(lib_crit.id, report.id, session)

    await move_finding_to_section(
        f_crit.id, sections[SeverityEnum.high].id, 1, session
    )

    await session.refresh(f1)
    await session.refresh(f2)
    assert f1.position == 2
    assert f2.position == 3


async def test_reorder_finding_up(session):
    from rawreporter.services.finding_service import reorder_finding
    from rawreporter.services.library_service import copy_library_finding_to_report

    report, _ = await _make_report(session)
    lib = await _make_library_finding(session, SeverityEnum.high)

    f1 = await copy_library_finding_to_report(lib.id, report.id, session)
    f2 = await copy_library_finding_to_report(lib.id, report.id, session)
    f3 = await copy_library_finding_to_report(lib.id, report.id, session)
    assert f1.position == 1
    assert f2.position == 2
    assert f3.position == 3

    # Move f3 to position 1
    await reorder_finding(f3.id, 1, session)

    await session.refresh(f1)
    await session.refresh(f2)
    await session.refresh(f3)
    assert f3.position == 1
    assert f1.position == 2
    assert f2.position == 3


async def test_reorder_finding_down(session):
    from rawreporter.services.finding_service import reorder_finding
    from rawreporter.services.library_service import copy_library_finding_to_report

    report, _ = await _make_report(session)
    lib = await _make_library_finding(session, SeverityEnum.high)

    f1 = await copy_library_finding_to_report(lib.id, report.id, session)
    f2 = await copy_library_finding_to_report(lib.id, report.id, session)
    f3 = await copy_library_finding_to_report(lib.id, report.id, session)

    # Move f1 to position 3
    await reorder_finding(f1.id, 3, session)

    await session.refresh(f1)
    await session.refresh(f2)
    await session.refresh(f3)
    assert f1.position == 3
    assert f2.position == 1
    assert f3.position == 2


# ─────────────────────────────────────────────
# Step 3: report_service tests
# ─────────────────────────────────────────────

async def test_section_seeding(session):
    from rawreporter.services.report_service import seed_report_sections

    client = Client(name="Seed Corp", industry="Energy", vertical="Power")
    session.add(client)
    await session.flush()

    eng = Engagement(
        client_id=client.id, title="E", type=EngagementTypeEnum.pentest,
        status=EngagementStatusEnum.active, engagement_lead="L",
    )
    session.add(eng)
    await session.flush()

    from rawreporter.models.report import Report
    report = Report(
        engagement_id=eng.id, title="R", audience=AudienceEnum.technical,
        status=ReportStatusEnum.draft,
    )
    session.add(report)
    await session.flush()

    sections = await seed_report_sections(report.id, session)

    assert len(sections) == 10

    by_pos = {s.position: s for s in sections}

    assert by_pos[4].section_type == SectionTypeEnum.critical_findings
    assert by_pos[4].severity_filter == SeverityEnum.critical
    assert by_pos[4].title == "Critical Findings"

    assert by_pos[10].section_type == SectionTypeEnum.appendix
    assert by_pos[10].is_visible is False

    assert by_pos[1].section_type == SectionTypeEnum.executive_summary
    assert by_pos[1].severity_filter is None
    assert by_pos[1].is_visible is True


async def test_validate_report_blocks_without_justification(session):
    from rawreporter.services.finding_service import move_finding_to_section
    from rawreporter.services.library_service import copy_library_finding_to_report
    from rawreporter.services.report_service import validate_report_for_generation

    report, sections = await _make_report(session)
    lib = await _make_library_finding(session, SeverityEnum.critical)
    finding = await copy_library_finding_to_report(lib.id, report.id, session)

    # Manually move critical finding into medium section — sets placement override
    await move_finding_to_section(
        finding.id, sections[SeverityEnum.medium].id, 1, session
    )

    with pytest.raises(HTTPException) as exc_info:
        await validate_report_for_generation(report.id, session)

    assert exc_info.value.status_code == 422
    detail = exc_info.value.detail
    assert "blocking_findings" in detail
    titles = [bf["title"] for bf in detail["blocking_findings"]]
    assert finding.title in titles


async def test_validate_report_allowed_with_justification(session):
    from rawreporter.services.finding_service import move_finding_to_section
    from rawreporter.services.library_service import copy_library_finding_to_report
    from rawreporter.services.report_service import validate_report_for_generation

    report, sections = await _make_report(session)
    lib = await _make_library_finding(session, SeverityEnum.critical)
    finding = await copy_library_finding_to_report(lib.id, report.id, session)

    await move_finding_to_section(
        finding.id, sections[SeverityEnum.medium].id, 1, session
    )

    # Provide justification — should unblock generation
    finding.override_justification = "Client requested grouping with medium findings"
    await session.flush()

    # Should not raise
    result = await validate_report_for_generation(report.id, session)
    assert result is None


async def test_validate_report_clean_report_passes(session):
    from rawreporter.services.library_service import copy_library_finding_to_report
    from rawreporter.services.report_service import validate_report_for_generation

    report, _ = await _make_report(session)
    lib = await _make_library_finding(session, SeverityEnum.high)
    await copy_library_finding_to_report(lib.id, report.id, session)

    # Normal import, no placement override — should pass
    result = await validate_report_for_generation(report.id, session)
    assert result is None
