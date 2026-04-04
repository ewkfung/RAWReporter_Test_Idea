import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.models.permission import Permission
from rawreporter.models.role import Role
from rawreporter.models.role_permission import RolePermission
from rawreporter.models.user_role import UserRole

logger = logging.getLogger(__name__)

# All permissions: (resource, action, description)
_PERMISSIONS: list[tuple[str, str, str]] = [
    ("client", "view", "View clients"),
    ("client", "create", "Create clients"),
    ("client", "edit", "Edit clients"),
    ("client", "delete", "Delete clients"),
    ("client", "archive", "Archive and restore clients"),
    ("engagement", "view", "View engagements"),
    ("engagement", "create", "Create engagements"),
    ("engagement", "edit", "Edit engagements"),
    ("engagement", "delete", "Delete engagements"),
    ("engagement", "archive", "Archive and restore engagements"),
    ("report", "view", "View reports"),
    ("report", "create", "Create reports"),
    ("report", "edit", "Edit reports"),
    ("report", "delete", "Delete reports"),
    ("report", "archive", "Archive and restore reports"),
    ("report", "generate", "Generate report documents"),
    ("finding", "view", "View findings"),
    ("finding", "create", "Create findings"),
    ("finding", "edit", "Edit findings"),
    ("finding", "delete", "Delete findings"),
    ("finding", "move", "Move/reorder findings"),
    ("library_finding", "view", "View library findings"),
    ("library_finding", "create", "Create library findings"),
    ("library_finding", "edit", "Edit library findings"),
    ("library_finding", "delete", "Delete library findings"),
    ("library_finding", "archive", "Archive library findings"),
    ("library_finding", "restore", "Restore archived library findings"),
    ("evidence", "view", "View evidence"),
    ("evidence", "upload", "Upload evidence"),
    ("evidence", "delete", "Delete evidence"),
    ("user", "view", "View users"),
    ("user", "create", "Create users"),
    ("user", "edit", "Edit users"),
    ("user", "delete", "Delete users"),
    ("user", "deactivate", "Deactivate users"),
    ("user", "assign_roles", "Assign roles to users"),
]

# Role definitions: name → (display_name, description, permission keys)
_ROLES: list[tuple[str, str, str, list[str]]] = [
    (
        "admin",
        "Admin",
        "Full access to all resources and actions",
        [f"{r}:{a}" for r, a, _ in _PERMISSIONS],
    ),
    (
        "lead",
        "Lead",
        "Manage engagements, reports, and findings; read-only library access",
        [
            "client:view", "client:create", "client:edit", "client:archive",
            "engagement:view", "engagement:create", "engagement:edit", "engagement:archive",
            "report:view", "report:create", "report:edit", "report:archive", "report:generate",
            "finding:view", "finding:create", "finding:edit", "finding:delete", "finding:move",
            "library_finding:view",
            "evidence:view", "evidence:upload", "evidence:delete",
        ],
    ),
    (
        "consultant",
        "Consultant",
        "Create and edit findings within assigned reports; read-only library access",
        [
            "client:view",
            "engagement:view",
            "report:view", "report:edit", "report:generate",
            "finding:view", "finding:create", "finding:edit", "finding:delete", "finding:move",
            "library_finding:view",
            "evidence:view", "evidence:upload",
        ],
    ),
    (
        "view_only",
        "View Only",
        "Read-only access to all resources",
        [
            "client:view",
            "engagement:view",
            "report:view",
            "finding:view",
            "library_finding:view",
            "evidence:view",
        ],
    ),
]


async def seed_roles_and_permissions(session: AsyncSession) -> None:
    """Idempotently seed built-in roles and permissions.

    Safe to call on every startup — uses INSERT ... ON CONFLICT DO NOTHING
    semantics via existence checks.
    """
    # 1. Upsert all permissions and build a lookup map
    perm_map: dict[str, Permission] = {}
    for resource, action, description in _PERMISSIONS:
        key = f"{resource}:{action}"
        result = await session.execute(
            select(Permission).where(
                Permission.resource == resource,
                Permission.action == action,
            )
        )
        perm = result.scalar_one_or_none()
        if perm is None:
            perm = Permission(resource=resource, action=action, description=description)
            session.add(perm)
            await session.flush()
            logger.debug("Created permission: %s", key)
        perm_map[key] = perm

    # 2. Upsert all roles and their permission assignments
    for name, display_name, description, perm_keys in _ROLES:
        result = await session.execute(select(Role).where(Role.name == name))
        role = result.scalar_one_or_none()
        if role is None:
            role = Role(
                name=name,
                display_name=display_name,
                description=description,
                is_system_role=True,
                is_active=True,
            )
            session.add(role)
            await session.flush()
            logger.debug("Created role: %s", name)

        # Ensure all expected permissions are linked to this role
        for key in perm_keys:
            perm = perm_map[key]
            result = await session.execute(
                select(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == perm.id,
                )
            )
            if result.scalar_one_or_none() is None:
                session.add(RolePermission(role_id=role.id, permission_id=perm.id))
                logger.debug("Linked permission %s to role %s", key, name)

    await session.commit()

    # 3. Assign Admin to any user who has no role yet (handles users
    #    registered before the RBAC system was introduced)
    admin_result = await session.execute(select(Role).where(Role.name == "admin"))
    admin_role = admin_result.scalar_one_or_none()
    if admin_role is not None:
        from rawreporter.auth.models import User  # avoid circular import at module level
        unassigned = await session.execute(
            select(User).where(
                ~User.id.in_(select(UserRole.user_id))
            )
        )
        for user in unassigned.scalars().all():
            session.add(UserRole(user_id=user.id, role_id=admin_role.id, assigned_by=None))
            logger.info("Backfilled Admin role for pre-RBAC user %s", user.id)
        await session.commit()

    logger.info("seed_roles_and_permissions complete")
