import logging
import uuid
from typing import Optional

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, UUIDIDMixin, exceptions
from fastapi_users.db import SQLAlchemyUserDatabase
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.config import get_settings
from rawreporter.database import get_db
from rawreporter.models.role import Role
from rawreporter.models.user_role import UserRole

logger = logging.getLogger(__name__)


async def get_user_db(session: AsyncSession = Depends(get_db)):
    yield SQLAlchemyUserDatabase(session, User)


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = get_settings().SECRET_KEY
    verification_token_secret = get_settings().SECRET_KEY

    async def authenticate(self, credentials: OAuth2PasswordRequestForm) -> Optional[User]:
        """
        Support login by username OR email.
        The OAuth2 form field is called 'username' — we first try to match it
        against our username column, then fall back to email.
        """
        # Try username lookup
        result = await self.user_db.session.execute(
            select(User).where(User.username == credentials.username)
        )
        user = result.scalar_one_or_none()

        # Fall back to email lookup
        if user is None:
            try:
                user = await self.get_by_email(credentials.username)
            except exceptions.UserNotExists:
                # Run hash anyway to prevent timing attacks
                self.password_helper.hash(credentials.password)
                return None

        verified, updated_hash = self.password_helper.verify_and_update(
            credentials.password, user.hashed_password
        )
        if not verified:
            return None

        if updated_hash:
            await self.user_db.update(user, {"hashed_password": updated_hash})

        return user

    async def on_after_register(self, user: User, request: Optional[Request] = None) -> None:
        session: AsyncSession = self.user_db.session

        # Count total users to determine role assignment
        count_result = await session.execute(select(func.count()).select_from(User))
        total_users = count_result.scalar_one()

        if total_users == 1:
            role_name = "admin"
            logger.info("First user registered — Admin role assigned to user %s", user.id)
        else:
            role_name = "view_only"

        role_result = await session.execute(select(Role).where(Role.name == role_name))
        role = role_result.scalar_one_or_none()

        if role is not None:
            session.add(UserRole(user_id=user.id, role_id=role.id, assigned_by=None))
            await session.commit()


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)
