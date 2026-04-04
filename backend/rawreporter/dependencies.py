import uuid
from typing import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth import current_active_user
from rawreporter.auth.models import User
from rawreporter.database import get_db
from rawreporter.models.permission import Permission
from rawreporter.models.role import Role
from rawreporter.models.role_permission import RolePermission
from rawreporter.models.user_role import UserRole


async def get_user_permissions(user_id: uuid.UUID, session: AsyncSession) -> list[str]:
    """Return all 'resource:action' strings the user has via their assigned roles."""
    result = await session.execute(
        select(Permission.resource, Permission.action)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
        .distinct()
    )
    return [f"{row.resource}:{row.action}" for row in result.all()]


def require_permission(resource: str, action: str) -> Callable:
    """Dependency factory — protects a route with a resource:action permission check.

    Usage:
        @router.delete("/{id}")
        async def delete_client(
            id: UUID,
            user: User = Depends(require_permission("client", "delete")),
            session: AsyncSession = Depends(get_db),
        ):
    """

    async def dependency(
        user: User = Depends(current_active_user),
        session: AsyncSession = Depends(get_db),
    ) -> User:
        permissions = await get_user_permissions(user.id, session)
        if f"{resource}:{action}" not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "detail": "Permission denied",
                    "required": f"{resource}:{action}",
                    "user_id": str(user.id),
                },
            )
        return user

    return dependency
