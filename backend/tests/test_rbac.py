"""
RBAC backend tests — Step A8.

Tests cover:
  - Role assignment on registration (first user → admin, subsequent → view_only)
  - Permission enforcement via require_permission dependency
"""
import uuid

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.models.client import Client
from rawreporter.models.engagement import Engagement
from rawreporter.models.finding import Finding
from rawreporter.models.report import Report
from rawreporter.models.report_section import ReportSection
from rawreporter.models.role import Role
from rawreporter.models.user_role import UserRole
from rawreporter.utils.enums import (
    AudienceEnum,
    EngagementStatusEnum,
    EngagementTypeEnum,
    ReportStatusEnum,
    SectionTypeEnum,
    SeverityEnum,
)
from tests.conftest import _seed_roles_no_commit, _make_test_user


# ── Helpers ────────────────────────────────────────────────────────────────

async def _seed_client(session: AsyncSession) -> Client:
    c = Client(name="RBAC Test Corp", industry="Energy", vertical="Oil & Gas")
    session.add(c)
    await session.flush()
    return c


async def _seed_engagement(session: AsyncSession, client: Client) -> Engagement:
    e = Engagement(
        client_id=client.id,
        title="RBAC Engagement",
        type=EngagementTypeEnum.pentest,
        status=EngagementStatusEnum.active,
        engagement_lead="Lead",
    )
    session.add(e)
    await session.flush()
    return e


async def _seed_report_with_finding(
    session: AsyncSession, engagement: Engagement
) -> tuple[Report, Finding]:
    report = Report(
        engagement_id=engagement.id,
        title="RBAC Test Report",
        audience=AudienceEnum.technical,
        status=ReportStatusEnum.draft,
    )
    session.add(report)
    await session.flush()

    section_defs = [
        (SectionTypeEnum.executive_summary, None, True, 1, "Executive Summary"),
        (SectionTypeEnum.findings_summary, None, True, 2, "Findings Summary"),
        (SectionTypeEnum.crown_jewel, None, True, 3, "Crown Jewel Assets"),
        (SectionTypeEnum.critical_findings, SeverityEnum.critical, True, 4, "Critical Findings"),
        (SectionTypeEnum.high_findings, SeverityEnum.high, True, 5, "High Findings"),
        (SectionTypeEnum.medium_findings, SeverityEnum.medium, True, 6, "Medium Findings"),
        (SectionTypeEnum.low_findings, SeverityEnum.low, True, 7, "Low Findings"),
        (SectionTypeEnum.informational, SeverityEnum.informational, True, 8, "Informational"),
        (SectionTypeEnum.closing, None, True, 9, "Closing"),
        (SectionTypeEnum.appendix, None, False, 10, "Appendix"),
    ]
    critical_section = None
    for stype, sev, visible, pos, title in section_defs:
        sec = ReportSection(
            report_id=report.id, section_type=stype, severity_filter=sev,
            is_visible=visible, position=pos, title=title,
        )
        session.add(sec)
        if stype == SectionTypeEnum.critical_findings:
            critical_section = sec
    await session.flush()

    finding = Finding(
        report_id=report.id,
        section_id=critical_section.id,
        title="Test Finding",
        summary="Summary",
        description_technical="Tech",
        description_executive="Exec",
        severity_default=SeverityEnum.critical,
        recommendation="Fix it",
        remediation_steps="Steps",
        remediation_steps_enabled=True,
        position=1,
        is_placement_override=False,
        is_ot_specific=False,
        ref_cve_enabled=False,
        ref_cwe_enabled=False,
        ref_cisa_enabled=False,
        ref_nist_enabled=False,
        ref_nvd_enabled=False,
        ref_manufacturer_enabled=False,
    )
    session.add(finding)
    await session.flush()
    return report, finding


def _make_http_client(app, session, user):
    """Returns a context manager yielding an httpx client wired to the given session/user.

    Patches session.commit → session.flush so route handler commits don't
    permanently write to the DB — allowing the test fixture rollback to clean up.
    """
    from rawreporter.database import get_db
    from rawreporter.auth import current_active_user

    async def _get_db():
        yield session

    async def _get_user():
        return user

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[current_active_user] = _get_user

    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    )


# ── Registration / role-assignment tests ──────────────────────────────────

async def test_first_user_gets_admin_role(session: AsyncSession):
    """on_after_register assigns Admin role when this is the first user."""
    from fastapi_users.db import SQLAlchemyUserDatabase
    from fastapi_users.password import PasswordHelper
    from rawreporter.auth.manager import UserManager

    await _seed_roles_no_commit(session)

    ph = PasswordHelper()
    user = User(
        email="first@rbac.test",
        username="firstrbac",
        hashed_password=ph.hash("pw"),
        is_active=True,
        is_superuser=False,
        is_verified=False,
    )
    session.add(user)
    await session.flush()

    user_db = SQLAlchemyUserDatabase(session, User)
    manager = UserManager(user_db)
    # Patch commit → flush so on_after_register stays within the test transaction
    orig = session.commit
    session.commit = session.flush  # type: ignore[method-assign]
    try:
        await manager.on_after_register(user)
    finally:
        session.commit = orig  # type: ignore[method-assign]

    user_role = (await session.execute(
        select(UserRole).where(UserRole.user_id == user.id)
    )).scalar_one_or_none()
    assert user_role is not None
    role = await session.get(Role, user_role.role_id)
    assert role is not None
    assert role.name == "admin"


async def test_second_user_gets_view_only_role(session: AsyncSession):
    """on_after_register assigns View Only role for users after the first."""
    from fastapi_users.db import SQLAlchemyUserDatabase
    from fastapi_users.password import PasswordHelper
    from rawreporter.auth.manager import UserManager

    await _seed_roles_no_commit(session)

    ph = PasswordHelper()
    # First user (seeded to ensure count >= 1 before second registers)
    first = User(
        email="first2@rbac.test", username="firstrbac2",
        hashed_password=ph.hash("pw"), is_active=True,
        is_superuser=False, is_verified=False,
    )
    session.add(first)
    await session.flush()

    second = User(
        email="second@rbac.test", username="secondrbac",
        hashed_password=ph.hash("pw"), is_active=True,
        is_superuser=False, is_verified=False,
    )
    session.add(second)
    await session.flush()

    user_db = SQLAlchemyUserDatabase(session, User)
    manager = UserManager(user_db)
    orig = session.commit
    session.commit = session.flush  # type: ignore[method-assign]
    try:
        await manager.on_after_register(second)
    finally:
        session.commit = orig  # type: ignore[method-assign]

    user_role = (await session.execute(
        select(UserRole).where(UserRole.user_id == second.id)
    )).scalar_one_or_none()
    assert user_role is not None
    role = await session.get(Role, user_role.role_id)
    assert role is not None
    assert role.name == "view_only"


# ── Permission enforcement tests ───────────────────────────────────────────

async def test_admin_can_delete_client(session: AsyncSession):
    """Admin user receives 204 when deleting a client."""
    from rawreporter.main import app

    role_map = await _seed_roles_no_commit(session)
    admin = await _make_test_user(session, role_map, "admin", "adm@rbac.test", "admrbac")
    client_obj = await _seed_client(session)

    orig = session.commit
    session.commit = session.flush  # type: ignore[method-assign]
    try:
        async with _make_http_client(app, session, admin) as http:
            resp = await http.delete(f"/api/v1/clients/{client_obj.id}")
    finally:
        session.commit = orig  # type: ignore[method-assign]
        app.dependency_overrides.clear()

    assert resp.status_code == 204


async def test_consultant_cannot_delete_client(session: AsyncSession):
    """Consultant receives 403 when attempting to delete a client."""
    from rawreporter.main import app

    role_map = await _seed_roles_no_commit(session)
    consultant = await _make_test_user(
        session, role_map, "consultant", "con@rbac.test", "conrbac"
    )
    client_obj = await _seed_client(session)

    orig = session.commit
    session.commit = session.flush  # type: ignore[method-assign]
    try:
        async with _make_http_client(app, session, consultant) as http:
            resp = await http.delete(f"/api/v1/clients/{client_obj.id}")
    finally:
        session.commit = orig  # type: ignore[method-assign]
        app.dependency_overrides.clear()

    assert resp.status_code == 403
    body = resp.json()
    assert body["detail"]["detail"] == "Permission denied"
    assert body["detail"]["required"] == "client:delete"


async def test_consultant_can_delete_finding(session: AsyncSession):
    """Consultant receives 204 when deleting a finding."""
    from rawreporter.main import app

    role_map = await _seed_roles_no_commit(session)
    consultant = await _make_test_user(
        session, role_map, "consultant", "con2@rbac.test", "conrbac2"
    )
    client_obj = await _seed_client(session)
    engagement = await _seed_engagement(session, client_obj)
    _, finding = await _seed_report_with_finding(session, engagement)

    orig = session.commit
    session.commit = session.flush  # type: ignore[method-assign]
    try:
        async with _make_http_client(app, session, consultant) as http:
            resp = await http.delete(f"/api/v1/findings/{finding.id}")
    finally:
        session.commit = orig  # type: ignore[method-assign]
        app.dependency_overrides.clear()

    assert resp.status_code == 204


async def test_view_only_cannot_create_finding(session: AsyncSession):
    """View-only user receives 403 when attempting to create a finding."""
    from rawreporter.main import app

    role_map = await _seed_roles_no_commit(session)
    viewer = await _make_test_user(
        session, role_map, "view_only", "view@rbac.test", "viewrbac"
    )

    orig = session.commit
    session.commit = session.flush  # type: ignore[method-assign]
    try:
        async with _make_http_client(app, session, viewer) as http:
            resp = await http.post("/api/v1/findings", json={
                "report_id": str(uuid.uuid4()),
                "section_id": str(uuid.uuid4()),
                "title": "Should not be created",
                "severity_default": "critical",
            })
    finally:
        session.commit = orig  # type: ignore[method-assign]
        app.dependency_overrides.clear()

    assert resp.status_code == 403
    body = resp.json()
    assert body["detail"]["detail"] == "Permission denied"
    assert body["detail"]["required"] == "finding:create"
