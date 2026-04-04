"""
Phase 3 API-level tests.
Uses the httpx client fixture which overrides get_db with the rolled-back test session.
"""
import pytest

from rawreporter.models.client import Client
from rawreporter.models.engagement import Engagement
from rawreporter.models.library_finding import LibraryFinding
from rawreporter.models.report import Report
from rawreporter.models.report_section import ReportSection
from rawreporter.utils.enums import (
    AudienceEnum,
    EngagementStatusEnum,
    EngagementTypeEnum,
    ReportStatusEnum,
    SectionTypeEnum,
    SeverityEnum,
)


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

async def _seed_client_engagement(session) -> tuple:
    client = Client(name="API Test Corp", industry="Energy", vertical="Oil & Gas")
    session.add(client)
    await session.flush()

    engagement = Engagement(
        client_id=client.id,
        title="API Test Engagement",
        type=EngagementTypeEnum.pentest,
        status=EngagementStatusEnum.active,
        engagement_lead="Lead",
    )
    session.add(engagement)
    await session.flush()
    return client, engagement


async def _seed_library_finding(session, severity: SeverityEnum = SeverityEnum.critical) -> LibraryFinding:
    lib = LibraryFinding(
        title="API Test Finding",
        summary="Summary",
        description_technical="Tech",
        description_executive="Exec",
        severity=severity,
        recommendation="Fix it",
        remediation_steps="Steps",
        remediation_steps_enabled=True,
        vertical="Oil & Gas",
        tags=[],
        framework_refs=[],
        questionnaire_trigger=[],
        is_ot_specific=False,
        ref_cve_enabled=False,
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
# test_section_seeding_on_report_create
# ─────────────────────────────────────────────

async def test_section_seeding_on_report_create(client, session):
    _, engagement = await _seed_client_engagement(session)

    resp = await client.post("/api/v1/reports", json={
        "engagement_id": str(engagement.id),
        "title": "Seeding Test Report",
        "audience": "technical",
    })
    assert resp.status_code == 201
    report_id = resp.json()["id"]

    resp = await client.get(f"/api/v1/reports/{report_id}/sections")
    assert resp.status_code == 200
    sections = resp.json()

    assert len(sections) == 10

    by_pos = {s["position"]: s for s in sections}

    # Critical findings section
    assert by_pos[4]["section_type"] == SectionTypeEnum.critical_findings.value
    assert by_pos[4]["severity_filter"] == SeverityEnum.critical.value
    assert by_pos[4]["title"] == "Critical Findings"
    assert by_pos[4]["is_visible"] is True

    # Appendix is hidden
    assert by_pos[10]["section_type"] == SectionTypeEnum.appendix.value
    assert by_pos[10]["is_visible"] is False

    # Executive summary has no severity filter
    assert by_pos[1]["section_type"] == SectionTypeEnum.executive_summary.value
    assert by_pos[1]["severity_filter"] is None


# ─────────────────────────────────────────────
# test_library_import_via_api
# ─────────────────────────────────────────────

async def test_library_import_via_api(client, session):
    _, engagement = await _seed_client_engagement(session)
    lib = await _seed_library_finding(session, SeverityEnum.high)

    resp = await client.post("/api/v1/reports", json={
        "engagement_id": str(engagement.id),
        "title": "Import Test Report",
        "audience": "technical",
    })
    assert resp.status_code == 201
    report_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/library/{lib.id}/import", json={
        "report_id": report_id,
    })
    assert resp.status_code == 201
    data = resp.json()

    assert data["finding"]["severity_default"] == SeverityEnum.high.value
    assert data["finding"]["severity_effective"] == SeverityEnum.high.value
    assert data["finding"]["is_placement_override"] is False
    assert data["section"]["severity_filter"] == SeverityEnum.high.value
    assert data["section"]["section_type"] == SectionTypeEnum.high_findings.value


# ─────────────────────────────────────────────
# test_severity_endpoint_moves_finding
# ─────────────────────────────────────────────

async def test_severity_endpoint_moves_finding(client, session):
    _, engagement = await _seed_client_engagement(session)
    lib = await _seed_library_finding(session, SeverityEnum.high)

    resp = await client.post("/api/v1/reports", json={
        "engagement_id": str(engagement.id),
        "title": "Severity Move Report",
        "audience": "technical",
    })
    report_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/library/{lib.id}/import", json={"report_id": report_id})
    finding_id = resp.json()["finding"]["id"]
    original_section_id = resp.json()["section"]["id"]

    resp = await client.patch(f"/api/v1/findings/{finding_id}/severity", json={
        "new_severity": "medium",
    })
    assert resp.status_code == 200
    updated = resp.json()

    assert updated["severity_override"] == "medium"
    assert updated["severity_effective"] == "medium"
    assert updated["section_id"] != original_section_id
    assert updated["is_placement_override"] is False


# ─────────────────────────────────────────────
# test_generation_blocked_via_api
# ─────────────────────────────────────────────

async def test_generation_blocked_via_api(client, session):
    _, engagement = await _seed_client_engagement(session)
    lib = await _seed_library_finding(session, SeverityEnum.critical)

    resp = await client.post("/api/v1/reports", json={
        "engagement_id": str(engagement.id),
        "title": "Generation Block Report",
        "audience": "technical",
    })
    report_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/library/{lib.id}/import", json={"report_id": report_id})
    finding_id = resp.json()["finding"]["id"]

    # Get the medium section id
    resp = await client.get(f"/api/v1/reports/{report_id}/sections")
    sections = resp.json()
    medium_section = next(s for s in sections if s["severity_filter"] == "medium")

    # Move critical finding to medium section — sets placement override, no justification
    resp = await client.patch(f"/api/v1/findings/{finding_id}/move", json={
        "target_section_id": medium_section["id"],
        "new_position": 1,
    })
    assert resp.status_code == 200
    assert resp.json()["is_placement_override"] is True

    # Generation should be blocked
    resp = await client.post(f"/api/v1/reports/{report_id}/generate")
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert "blocking_findings" in detail
    assert any(bf["title"] == lib.title for bf in detail["blocking_findings"])


# ─────────────────────────────────────────────
# test_generation_passes_with_justification_via_api
# ─────────────────────────────────────────────

async def test_generation_passes_with_justification_via_api(client, session):
    _, engagement = await _seed_client_engagement(session)
    lib = await _seed_library_finding(session, SeverityEnum.critical)

    resp = await client.post("/api/v1/reports", json={
        "engagement_id": str(engagement.id),
        "title": "Generation Pass Report",
        "audience": "technical",
    })
    report_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/library/{lib.id}/import", json={"report_id": report_id})
    finding_id = resp.json()["finding"]["id"]

    resp = await client.get(f"/api/v1/reports/{report_id}/sections")
    sections = resp.json()
    medium_section = next(s for s in sections if s["severity_filter"] == "medium")

    await client.patch(f"/api/v1/findings/{finding_id}/move", json={
        "target_section_id": medium_section["id"],
        "new_position": 1,
    })

    # Provide justification via the general PATCH
    resp = await client.patch(f"/api/v1/findings/{finding_id}", json={
        "override_justification": "Client requested grouping with medium findings",
    })
    assert resp.status_code == 200

    # Generation should now pass
    resp = await client.post(f"/api/v1/reports/{report_id}/generate")
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"
    assert resp.json()["report_id"] == report_id
