#!/usr/bin/env python3
"""
Seed test users for manual permission/role testing.

Run from the backend directory:
    python seed_test_users.py

Creates three users with known credentials, each assigned a different role:

    view_only@test.local   / TestPass123!   (View Only)
    consultant@test.local  / TestPass123!   (Consultant)
    lead@test.local        / TestPass123!   (Lead)

Safe to run multiple times — skips users whose email already exists.
"""

import asyncio
import sys
import uuid
from pathlib import Path

# Allow importing from the rawreporter package without installing it
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = (
    "postgresql+asyncpg://rawreporter:rawreporter@localhost:5432/rawreporter"
)

TEST_USERS = [
    {
        "username": "test_viewonly",
        "email": "viewonly@test.local",
        "password": "TestPass123!",
        "first_name": "Test",
        "last_name": "ViewOnly",
        "role": "view_only",
    },
    {
        "username": "test_consultant",
        "email": "consultant@test.local",
        "password": "TestPass123!",
        "first_name": "Test",
        "last_name": "Consultant",
        "role": "consultant",
    },
    {
        "username": "test_lead",
        "email": "lead@test.local",
        "password": "TestPass123!",
        "first_name": "Test",
        "last_name": "Lead",
        "role": "lead",
    },
]


async def main() -> None:
    from fastapi_users.password import PasswordHelper

    from rawreporter.auth.models import User
    from rawreporter.models.role import Role
    from rawreporter.models.user_role import UserRole

    pwd_helper = PasswordHelper()
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        for u in TEST_USERS:
            # Skip if email already registered
            result = await session.execute(
                select(User).where(User.email == u["email"])
            )
            if result.scalar_one_or_none() is not None:
                print(f"  [skip] {u['email']} already exists")
                continue

            # Hash password using the same helper FastAPI-Users uses
            hashed = pwd_helper.hash(u["password"])
            user = User(
                id=uuid.uuid4(),
                email=u["email"],
                hashed_password=hashed,
                username=u["username"],
                first_name=u["first_name"],
                last_name=u["last_name"],
                is_active=True,
                is_superuser=False,
                is_verified=True,
            )
            session.add(user)
            await session.flush()

            # Look up role by name (uses UUIDs seeded by seed_rbac)
            role_result = await session.execute(
                select(Role).where(Role.name == u["role"])
            )
            role = role_result.scalar_one_or_none()
            if role is None:
                print(f"  [warn] role '{u['role']}' not found — run the app once to seed roles first")
            else:
                session.add(UserRole(user_id=user.id, role_id=role.id, assigned_by=None))

            print(f"  [ok]   {u['role']:12s}  {u['email']}  /  {u['password']}")

        await session.commit()

    await engine.dispose()
    print("\nDone. Log in at http://localhost:5173/login with the credentials above.")


if __name__ == "__main__":
    asyncio.run(main())
