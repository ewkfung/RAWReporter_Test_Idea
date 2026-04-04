import asyncio

import asyncpg
import pytest
import httpx
from fastapi_users.password import PasswordHelper
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from rawreporter.auth.models import User
from rawreporter.models.base import Base
from rawreporter.models.permission import Permission
from rawreporter.models.role import Role
from rawreporter.models.role_permission import RolePermission
from rawreporter.models.user_role import UserRole
import rawreporter.models  # noqa: F401 — registers all models with Base.metadata
import rawreporter.auth.models  # noqa: F401 — registers User table

TEST_DB_NAME = "rawreporter_test"
TEST_ASYNC_URL = f"postgresql+asyncpg://rawreporter:rawreporter@localhost:5432/{TEST_DB_NAME}"
ADMIN_URL = "postgresql://rawreporter:rawreporter@localhost:5432/postgres"

# Module-level engine: NullPool means no connections are held here —
# actual connections are only created inside test-function event loops.
_engine = create_async_engine(TEST_ASYNC_URL, poolclass=NullPool)

_password_helper = PasswordHelper()

# ── Role/permission definitions (mirrors seed_rbac.py) ────────────────────

_PERMISSIONS: list[tuple[str, str]] = [
    ("client", "view"), ("client", "create"), ("client", "edit"), ("client", "delete"),
    ("engagement", "view"), ("engagement", "create"), ("engagement", "edit"), ("engagement", "delete"),
    ("report", "view"), ("report", "create"), ("report", "edit"), ("report", "delete"), ("report", "generate"),
    ("finding", "view"), ("finding", "create"), ("finding", "edit"), ("finding", "delete"), ("finding", "move"),
    ("library_finding", "view"), ("library_finding", "create"), ("library_finding", "edit"),
    ("library_finding", "delete"), ("library_finding", "archive"), ("library_finding", "restore"),
    ("evidence", "view"), ("evidence", "upload"), ("evidence", "delete"),
    ("user", "view"), ("user", "create"), ("user", "edit"), ("user", "deactivate"), ("user", "assign_roles"),
]

_ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": [f"{r}:{a}" for r, a in _PERMISSIONS],
    "lead": [
        "client:view", "client:create", "client:edit",
        "engagement:view", "engagement:create", "engagement:edit",
        "report:view", "report:create", "report:edit", "report:generate",
        "finding:view", "finding:create", "finding:edit", "finding:delete", "finding:move",
        "library_finding:view",
        "evidence:view", "evidence:upload", "evidence:delete",
    ],
    "consultant": [
        "client:view", "engagement:view",
        "report:view", "report:edit", "report:generate",
        "finding:view", "finding:create", "finding:edit", "finding:delete", "finding:move",
        "library_finding:view",
        "evidence:view", "evidence:upload",
    ],
    "view_only": [
        "client:view", "engagement:view", "report:view",
        "finding:view", "library_finding:view", "evidence:view",
    ],
}


async def _seed_roles_no_commit(session: AsyncSession) -> dict[str, Role]:
    """Seed all roles and permissions into the session using flush (no commit).

    Safe for use in rolled-back test sessions — data is visible within the
    session but cleaned up by the fixture's rollback.
    """
    # Create all permissions
    perm_map: dict[str, Permission] = {}
    for resource, action in _PERMISSIONS:
        key = f"{resource}:{action}"
        perm = Permission(resource=resource, action=action)
        session.add(perm)
        perm_map[key] = perm
    await session.flush()

    # Create roles and link permissions
    role_map: dict[str, Role] = {}
    for role_name, display_name in [
        ("admin", "Admin"), ("lead", "Lead"),
        ("consultant", "Consultant"), ("view_only", "View Only"),
    ]:
        role = Role(name=role_name, display_name=display_name, is_system_role=True, is_active=True)
        session.add(role)
        await session.flush()
        for key in _ROLE_PERMISSIONS[role_name]:
            session.add(RolePermission(role_id=role.id, permission_id=perm_map[key].id))
        role_map[role_name] = role

    await session.flush()
    return role_map


async def _make_test_user(
    session: AsyncSession,
    role_map: dict[str, Role],
    role_name: str,
    email: str,
    username: str,
) -> User:
    """Create a test user with the given role, flushed into the session."""
    user = User(
        email=email,
        username=username,
        first_name="Test",
        last_name=role_name.title(),
        hashed_password=_password_helper.hash("password123"),
        is_active=True,
        is_superuser=False,
        is_verified=False,
    )
    session.add(user)
    await session.flush()
    session.add(UserRole(user_id=user.id, role_id=role_map[role_name].id))
    await session.flush()
    return user


async def _create_test_db() -> None:
    conn = await asyncpg.connect(ADMIN_URL)
    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", TEST_DB_NAME
        )
        if not exists:
            await conn.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')
        else:
            # Terminate any zombie connections from previously-killed test runs.
            await conn.execute(
                """
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = $1
                  AND pid != pg_backend_pid()
                """,
                TEST_DB_NAME,
            )
    finally:
        await conn.close()


async def _create_tables() -> None:
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _drop_tables() -> None:
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    asyncio.run(_create_test_db())
    asyncio.run(_create_tables())
    yield
    asyncio.run(_drop_tables())


@pytest.fixture
async def session():
    """
    Each test gets a fresh AsyncSession bound to the test's own function-scoped
    event loop. NullPool ensures no connection is reused across tests.
    Always rolls back so tests never pollute each other.
    """
    async with AsyncSession(_engine, expire_on_commit=False) as sess:
        await sess.begin()
        try:
            yield sess
        finally:
            await sess.rollback()


@pytest.fixture
async def client(session):
    """
    HTTP test client authenticated as an admin user.
    Overrides both get_db and current_active_user so all protected routes work.

    session.commit is patched to session.flush so that route handlers calling
    db.commit() only flush within the outer transaction — allowing the fixture's
    rollback() to cleanly undo all test data.
    """
    from rawreporter.main import app
    from rawreporter.database import get_db
    from rawreporter.auth import current_active_user

    role_map = await _seed_roles_no_commit(session)
    admin = await _make_test_user(session, role_map, "admin", "admin@test.local", "testadmin")

    # Patch commit → flush so handlers don't permanently commit test data
    original_commit = session.commit
    session.commit = session.flush  # type: ignore[method-assign]

    async def override_get_db():
        yield session

    async def override_current_user():
        return admin

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[current_active_user] = override_current_user

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c

    session.commit = original_commit  # type: ignore[method-assign]
    app.dependency_overrides.clear()
