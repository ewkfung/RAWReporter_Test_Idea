import pytest
from sqlalchemy import select
from rawreporter.models.client import Client
from rawreporter.models.engagement import Engagement
from rawreporter.models.report import Report
from rawreporter.models.report_section import ReportSection
from rawreporter.models.finding import Finding
from rawreporter.models.library_finding import LibraryFinding
from rawreporter.utils.enums import (
    EngagementTypeEnum,
    EngagementStatusEnum,
    AudienceEnum,
    ReportStatusEnum,
    SectionTypeEnum,
    SeverityEnum,
)


# ─────────────────────────────────────────────
# CLIENT
# ─────────────────────────────────────────────

async def test_create_client(session):
    client = Client(
        name="Acme Oil & Gas",
        industry="Oil & Gas",
        vertical="Oil & Gas",
        primary_contact="John Smith",
        contact_email="jsmith@acme.com",
    )
    session.add(client)
    await session.flush()

    result = await session.execute(select(Client).where(Client.id == client.id))
    fetched = result.scalar_one()

    assert fetched.name == "Acme Oil & Gas"
    assert fetched.id is not None          # UUID was generated
    assert fetched.created_at is not None  # Timestamp was set


# ─────────────────────────────────────────────
# ENGAGEMENT
# ─────────────────────────────────────────────

async def test_create_engagement(session):
    client = Client(name="Test Client", industry="Power", vertical="Power Generation")
    session.add(client)
    await session.flush()

    engagement = Engagement(
        client_id=client.id,
        title="2024 OT Gap Assessment",
        type=EngagementTypeEnum.gap_assessment,
        status=EngagementStatusEnum.active,
        engagement_lead="Jane Doe",
    )
    session.add(engagement)
    await session.flush()

    result = await session.execute(
        select(Engagement).where(Engagement.id == engagement.id)
    )
    fetched = result.scalar_one()

    assert fetched.title == "2024 OT Gap Assessment"
    assert fetched.type == EngagementTypeEnum.gap_assessment
    assert fetched.client_id == client.id


async def test_engagement_requires_client(session):
    """Engagement without a valid client_id should fail."""
    import uuid
    engagement = Engagement(
        client_id=uuid.uuid4(),  # Non-existent client
        title="Orphan Engagement",
        type=EngagementTypeEnum.pentest,
        status=EngagementStatusEnum.scoping,
        engagement_lead="Nobody",
    )
    session.add(engagement)
    with pytest.raises(Exception):  # FK violation
        await session.flush()


# ─────────────────────────────────────────────
# REPORT + SECTIONS
# ─────────────────────────────────────────────

async def test_report_sections_seeded(session):
    """
    When a report is created and sections are seeded,
    verify all 10 sections exist in the correct order.
    """
    client = Client(name="Section Test Client", industry="Chemical", vertical="Chemical")
    session.add(client)
    await session.flush()

    engagement = Engagement(
        client_id=client.id,
        title="Chemical Plant Assessment",
        type=EngagementTypeEnum.pentest,
        status=EngagementStatusEnum.active,
        engagement_lead="Lead",
    )
    session.add(engagement)
    await session.flush()

    report = Report(
        engagement_id=engagement.id,
        audience=AudienceEnum.technical,
        title="Chemical Plant Pentest Report",
        status=ReportStatusEnum.draft,
    )
    session.add(report)
    await session.flush()

    # Seed the 10 default sections
    default_sections = [
        (1,  SectionTypeEnum.executive_summary,  None),
        (2,  SectionTypeEnum.findings_summary,   None),
        (3,  SectionTypeEnum.crown_jewel,         None),
        (4,  SectionTypeEnum.critical_findings,   SeverityEnum.critical),
        (5,  SectionTypeEnum.high_findings,       SeverityEnum.high),
        (6,  SectionTypeEnum.medium_findings,     SeverityEnum.medium),
        (7,  SectionTypeEnum.low_findings,        SeverityEnum.low),
        (8,  SectionTypeEnum.informational,       SeverityEnum.informational),
        (9,  SectionTypeEnum.closing,             None),
        (10, SectionTypeEnum.appendix,            None),
    ]
    for position, section_type, severity_filter in default_sections:
        section = ReportSection(
            report_id=report.id,
            section_type=section_type,
            severity_filter=severity_filter,
            title=section_type.value.replace("_", " ").title(),
            position=position,
            is_visible=True,
        )
        session.add(section)
    await session.flush()

    result = await session.execute(
        select(ReportSection)
        .where(ReportSection.report_id == report.id)
        .order_by(ReportSection.position)
    )
    sections = result.scalars().all()

    assert len(sections) == 10
    assert sections[0].section_type == SectionTypeEnum.executive_summary
    assert sections[3].section_type == SectionTypeEnum.critical_findings
    assert sections[3].severity_filter == SeverityEnum.critical
    assert sections[9].section_type == SectionTypeEnum.appendix


# ─────────────────────────────────────────────
# FINDING — SEVERITY LOGIC
# ─────────────────────────────────────────────

async def test_finding_severity_effective(session):
    """
    severity_effective should return severity_override when set,
    otherwise severity_default.
    """
    client = Client(name="Severity Test", industry="Pharma", vertical="Pharmaceutical")
    session.add(client)
    await session.flush()

    engagement = Engagement(
        client_id=client.id,
        title="Pharma Assessment",
        type=EngagementTypeEnum.gap_assessment,
        status=EngagementStatusEnum.active,
        engagement_lead="Lead",
    )
    session.add(engagement)
    await session.flush()

    report = Report(
        engagement_id=engagement.id,
        audience=AudienceEnum.technical,
        title="Pharma Report",
        status=ReportStatusEnum.draft,
    )
    session.add(report)
    await session.flush()

    # Get the high findings section
    high_section = ReportSection(
        report_id=report.id,
        section_type=SectionTypeEnum.high_findings,
        severity_filter=SeverityEnum.high,
        title="High Level Findings",
        position=5,
        is_visible=True,
    )
    session.add(high_section)
    await session.flush()

    # Finding with no override — effective = default
    finding = Finding(
        section_id=high_section.id,
        title="Default Credentials on HMI",
        severity_default=SeverityEnum.high,
        severity_override=None,
        is_placement_override=False,
        summary="Default credentials found.",
        recommendation="Change all default credentials.",
        remediation_steps="1. Log into device. 2. Change password.",
        remediation_steps_enabled=True,
        description_technical="Technical detail here.",
        description_executive="Executive summary here.",
        position=1,
    )
    session.add(finding)
    await session.flush()

    assert finding.severity_effective == SeverityEnum.high

    # Now override to medium
    finding.severity_override = SeverityEnum.medium
    await session.flush()

    assert finding.severity_effective == SeverityEnum.medium


async def test_placement_override_requires_justification(session):
    """
    A finding with is_placement_override=True and no justification
    should be detectable — this is what blocks report generation.
    """
    client = Client(name="Override Test", industry="Refining", vertical="Refining")
    session.add(client)
    await session.flush()

    engagement = Engagement(
        client_id=client.id,
        title="Refinery Assessment",
        type=EngagementTypeEnum.pentest,
        status=EngagementStatusEnum.active,
        engagement_lead="Lead",
    )
    session.add(engagement)
    await session.flush()

    report = Report(
        engagement_id=engagement.id,
        audience=AudienceEnum.technical,
        title="Refinery Report",
        status=ReportStatusEnum.draft,
    )
    session.add(report)
    await session.flush()

    medium_section = ReportSection(
        report_id=report.id,
        section_type=SectionTypeEnum.medium_findings,
        severity_filter=SeverityEnum.medium,
        title="Medium Level Findings",
        position=6,
        is_visible=True,
    )
    session.add(medium_section)
    await session.flush()

    # Critical finding manually placed in medium section — no justification
    finding = Finding(
        section_id=medium_section.id,
        title="Unauthenticated PLC Access",
        severity_default=SeverityEnum.critical,
        severity_override=None,
        is_placement_override=True,
        override_justification=None,  # Missing — should block generation
        summary="Direct unauthenticated access to PLC.",
        recommendation="Implement authentication.",
        remediation_steps="Enable authentication on PLC.",
        remediation_steps_enabled=True,
        description_technical="Technical detail.",
        description_executive="Executive summary.",
        position=1,
    )
    session.add(finding)
    await session.flush()

    # Simulate the validation check report_service will run
    result = await session.execute(
        select(Finding).where(
            Finding.section_id == medium_section.id,
            Finding.is_placement_override == True,
            Finding.override_justification == None,
        )
    )
    blocking_findings = result.scalars().all()

    assert len(blocking_findings) == 1
    assert blocking_findings[0].title == "Unauthenticated PLC Access"


# ─────────────────────────────────────────────
# LIBRARY FINDING
# ─────────────────────────────────────────────

async def test_library_finding_created(session):
    lib_finding = LibraryFinding(
        title="Default Credentials",
        summary="Device uses factory default credentials.",
        description_technical="The device was found using default credentials.",
        description_executive="Critical devices are using default passwords.",
        severity=SeverityEnum.critical,
        cvss_score_default=9.8,
        recommendation="Change all default credentials immediately.",
        remediation_steps="1. Access device. 2. Navigate to user settings. 3. Update.",
        remediation_steps_enabled=True,
        vertical="Oil & Gas",
        tags=["credentials", "authentication", "ot"],
        framework_refs=["IEC-62443-SR-1.1", "NIST-SP-800-82"],
        questionnaire_trigger=["default_credentials", "no_password_policy"],
        is_ot_specific=True,
        ref_cve_enabled=True,
        ref_cwe_enabled=True,
        ref_cisa_enabled=True,
        ref_nist_enabled=True,
        ref_nvd_enabled=True,
        ref_manufacturer_enabled=False,
    )
    session.add(lib_finding)
    await session.flush()

    result = await session.execute(
        select(LibraryFinding).where(LibraryFinding.id == lib_finding.id)
    )
    fetched = result.scalar_one()

    assert fetched.title == "Default Credentials"
    assert fetched.severity == SeverityEnum.critical
    assert "credentials" in fetched.tags
    assert fetched.is_ot_specific is True
    assert fetched.questionnaire_trigger == ["default_credentials", "no_password_policy"]