"""
Report Builder backend tests — Step A5.

Tests cover:
  1. Vulnerability assessment report seeds correct sections
  2. Pentest report seeds correct sections
  3. Risk assessment report seeds correct sections
  4. Tabletop engagement → 422 on report create
  5. Default template pre-populates section body_text
  6. Missing template → body_text is None
  7. Template upsert is idempotent (PUT twice, second wins)
  8. GET /templates/{engagement_type} returns ordered section list
"""
import pytest

from rawreporter.models.client import Client
from rawreporter.models.engagement import Engagement
from rawreporter.models.report_default_template import ReportDefaultTemplate
from rawreporter.services.report_service import SECTION_STRUCTURES
from rawreporter.utils.enums import EngagementTypeEnum, SectionTypeEnum


# ── Helpers ────────────────────────────────────────────────────────────────

async def _seed_client(session) -> Client:
    c = Client(name="Builder Test Corp")
    session.add(c)
    await session.flush()
    return c


async def _seed_engagement(session, client: Client, eng_type: EngagementTypeEnum) -> Engagement:
    e = Engagement(
        client_id=client.id,
        title=f"{eng_type.value} Engagement",
        types=[eng_type.value],
    )
    session.add(e)
    await session.flush()
    return e


# ── Test 1: Vulnerability assessment section structure ─────────────────────

@pytest.mark.asyncio
async def test_vulnerability_assessment_sections(client, session):
    """Creating a VA report seeds the correct 14 sections in position order."""
    c = await _seed_client(session)
    eng = await _seed_engagement(session, c, EngagementTypeEnum.vulnerability_assessment)

    resp = await client.post("/api/v1/reports", json={
        "title": "VA Report",
        "engagement_id": str(eng.id),
        "types": ["vulnerability_assessment"],
    })
    assert resp.status_code == 201, resp.text
    report_id = resp.json()["id"]

    resp = await client.get(f"/api/v1/reports/{report_id}/sections")
    assert resp.status_code == 200
    sections = resp.json()
    sections.sort(key=lambda s: s["position"])

    structure = SECTION_STRUCTURES[EngagementTypeEnum.vulnerability_assessment]
    # Expected: all structure entries plus 5 severity sub-sections after 'findings'
    expected_types = []
    for _, stype, _, _ in structure:
        expected_types.append(stype.value)
        if stype == SectionTypeEnum.findings:
            from rawreporter.services.report_service import _SEVERITY_SUB_SECTIONS
            for sub_type, _, _, _ in _SEVERITY_SUB_SECTIONS:
                expected_types.append(sub_type.value)

    actual_types = [s["section_type"] for s in sections]
    assert actual_types == expected_types
    assert len(sections) == 14  # 9 text/container + 5 severity


# ── Test 2: Pentest section structure ──────────────────────────────────────

@pytest.mark.asyncio
async def test_pentest_sections(client, session):
    """Creating a pentest report seeds the correct 16 sections."""
    c = await _seed_client(session)
    eng = await _seed_engagement(session, c, EngagementTypeEnum.pentest)

    resp = await client.post("/api/v1/reports", json={
        "title": "Pentest Report",
        "engagement_id": str(eng.id),
        "types": ["pentest"],
    })
    assert resp.status_code == 201, resp.text
    report_id = resp.json()["id"]

    resp = await client.get(f"/api/v1/reports/{report_id}/sections")
    assert resp.status_code == 200
    sections = sorted(resp.json(), key=lambda s: s["position"])

    # Pentest has scope_and_rules_of_engagement, methodology, attack_path instead of VA variants
    section_types = [s["section_type"] for s in sections]
    assert "scope_and_rules_of_engagement" in section_types
    assert "methodology" in section_types
    assert "attack_path" in section_types
    assert "scope_and_methodology" not in section_types
    assert len(sections) == 16  # 11 text/container + 5 severity

    # First section must be report_title
    assert sections[0]["section_type"] == "report_title"
    # findings container must be present
    assert "findings" in section_types


# ── Test 3: Risk assessment section structure ──────────────────────────────

@pytest.mark.asyncio
async def test_risk_sections(client, session):
    """Creating a risk report seeds risk-specific sections."""
    c = await _seed_client(session)
    eng = await _seed_engagement(session, c, EngagementTypeEnum.risk)

    resp = await client.post("/api/v1/reports", json={
        "title": "Risk Report",
        "engagement_id": str(eng.id),
        "types": ["risk"],
    })
    assert resp.status_code == 201, resp.text
    report_id = resp.json()["id"]

    resp = await client.get(f"/api/v1/reports/{report_id}/sections")
    assert resp.status_code == 200
    sections = sorted(resp.json(), key=lambda s: s["position"])
    section_types = [s["section_type"] for s in sections]

    assert "risk_assessment_approach" in section_types
    assert "risk_assessment_result" in section_types
    assert len(sections) == 14  # 9 text/container + 5 severity
    assert sections[0]["section_type"] == "report_title"


# ── Test 4: Tabletop engagement → 422 ──────────────────────────────────────

@pytest.mark.asyncio
async def test_tabletop_report_create_422(client, session):
    """Attempting to create a report for a tabletop engagement returns 422."""
    c = await _seed_client(session)
    eng = await _seed_engagement(session, c, EngagementTypeEnum.tabletop)

    resp = await client.post("/api/v1/reports", json={
        "title": "Tabletop Report",
        "engagement_id": str(eng.id),
        "types": ["tabletop"],
    })
    assert resp.status_code == 422
    assert "does not have a report builder" in resp.json()["detail"]


# ── Test 5: Template pre-population ────────────────────────────────────────

@pytest.mark.asyncio
async def test_template_prepopulation(client, session):
    """A saved default template pre-fills body_text when seeding sections."""
    # Seed a default template for executive_summary on VA reports
    template = ReportDefaultTemplate(
        engagement_type=EngagementTypeEnum.vulnerability_assessment.value,
        section_type=SectionTypeEnum.executive_summary,
        default_body="This is the pre-filled executive summary.",
    )
    session.add(template)
    await session.flush()

    c = await _seed_client(session)
    eng = await _seed_engagement(session, c, EngagementTypeEnum.vulnerability_assessment)

    resp = await client.post("/api/v1/reports", json={
        "title": "Pre-filled Report",
        "engagement_id": str(eng.id),
        "types": ["vulnerability_assessment"],
    })
    assert resp.status_code == 201, resp.text
    report_id = resp.json()["id"]

    resp = await client.get(f"/api/v1/reports/{report_id}/sections")
    assert resp.status_code == 200
    sections = resp.json()

    exec_section = next(s for s in sections if s["section_type"] == "executive_summary")
    assert exec_section["body_text"] == "This is the pre-filled executive summary."


# ── Test 6: No template → body_text is None ────────────────────────────────

@pytest.mark.asyncio
async def test_no_template_body_is_none(client, session):
    """When no default template exists, seeded sections have body_text = None."""
    c = await _seed_client(session)
    eng = await _seed_engagement(session, c, EngagementTypeEnum.vulnerability_assessment)

    resp = await client.post("/api/v1/reports", json={
        "title": "Empty Report",
        "engagement_id": str(eng.id),
        "types": ["vulnerability_assessment"],
    })
    assert resp.status_code == 201, resp.text
    report_id = resp.json()["id"]

    resp = await client.get(f"/api/v1/reports/{report_id}/sections")
    assert resp.status_code == 200
    sections = resp.json()

    for section in sections:
        assert section["body_text"] is None, (
            f"Expected null body_text for {section['section_type']}, "
            f"got: {section['body_text']!r}"
        )


# ── Test 7: Template upsert is idempotent ──────────────────────────────────

@pytest.mark.asyncio
async def test_template_upsert_idempotent(client, session):
    """PUT /templates/{type}/{section} is idempotent — second PUT overwrites first."""
    url = "/api/v1/templates/vulnerability_assessment/executive_summary"

    resp = await client.put(url, json={"default_body": "First version"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["default_body"] == "First version"

    resp = await client.put(url, json={"default_body": "Second version"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["default_body"] == "Second version"

    # GET to confirm persistence
    resp = await client.get("/api/v1/templates/vulnerability_assessment")
    assert resp.status_code == 200
    entries = resp.json()
    exec_entry = next(e for e in entries if e["section_type"] == "executive_summary")
    assert exec_entry["default_body"] == "Second version"


# ── Test 8: GET templates for type returns ordered list ────────────────────

@pytest.mark.asyncio
async def test_get_templates_for_type(client, session):
    """GET /templates/{engagement_type} returns all sections in builder order."""
    resp = await client.get("/api/v1/templates/pentest")
    assert resp.status_code == 200
    entries = resp.json()

    # Should contain all sections from pentest structure + severity sub-sections
    section_types = [e["section_type"] for e in entries]
    assert "report_title" in section_types
    assert "scope_and_rules_of_engagement" in section_types
    assert "attack_path" in section_types
    assert "findings" in section_types
    assert "critical_findings" in section_types
    assert "remediation_roadmap" in section_types
    assert "appendix" in section_types

    # First entry must be report_title (position 1)
    assert entries[0]["section_type"] == "report_title"

    # Unknown type → 404
    resp = await client.get("/api/v1/templates/unknown_type")
    assert resp.status_code == 404

    # Legacy type with no builder → 422
    resp = await client.get("/api/v1/templates/tabletop")
    assert resp.status_code == 422
