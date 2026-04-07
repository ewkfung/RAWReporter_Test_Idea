import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi_users.password import PasswordHelper
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth import current_active_user
from rawreporter.auth.models import User
from rawreporter.database import get_db
from rawreporter.dependencies import get_user_permissions, require_permission
from rawreporter.models.permission import Permission
from rawreporter.models.role import Role
from rawreporter.models.role_permission import RolePermission
from rawreporter.models.user_role import UserRole
from rawreporter.services import audit_service
from rawreporter.utils.enums import AuditActionEnum

router = APIRouter(tags=["users"])


# ── Schemas ────────────────────────────────────────────────────────────────

class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    display_name: str
    description: str | None = None
    is_system_role: bool


class RoleWithPermissionsRead(RoleRead):
    permissions: list[str] = []  # "resource:action" strings


class UserWithRolesRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    username: str
    first_name: str
    last_name: str
    is_active: bool
    created_at: datetime
    roles: list[RoleRead] = []


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    username: str
    first_name: str = ""
    last_name: str = ""
    role_id: uuid.UUID


class UserPatch(BaseModel):
    email: EmailStr | None = None
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool | None = None
    password: str | None = None


class AssignRoleBody(BaseModel):
    role_id: uuid.UUID


# ── Helpers ────────────────────────────────────────────────────────────────

async def _get_user_with_roles(user_id: uuid.UUID, session: AsyncSession) -> UserWithRolesRead:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    roles_result = await session.execute(
        select(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    )
    roles = roles_result.scalars().all()
    return UserWithRolesRead(
        id=user.id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        created_at=user.created_at,
        roles=[RoleRead.model_validate(r) for r in roles],
    )


# ── Routes ─────────────────────────────────────────────────────────────────

@router.get("/users/me", response_model=UserWithRolesRead)
async def get_me(
    current_user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_user_with_roles(current_user.id, db)


@router.patch("/users/me", response_model=UserWithRolesRead)
async def update_me(
    payload: UserPatch,
    current_user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    await db.commit()
    return await _get_user_with_roles(current_user.id, db)


@router.get("/users/me/permissions", response_model=list[str])
async def get_my_permissions(
    current_user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_user_permissions(current_user.id, db)


@router.get("/users", response_model=list[UserWithRolesRead])
async def list_users(
    _: User = Depends(require_permission("user", "view")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    return [await _get_user_with_roles(u.id, db) for u in users]


@router.get("/users/{user_id}", response_model=UserWithRolesRead)
async def get_user(
    user_id: uuid.UUID,
    _: User = Depends(require_permission("user", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await _get_user_with_roles(user_id, db)


@router.post("/users", response_model=UserWithRolesRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: AdminUserCreate,
    request: Request,
    current_user: User = Depends(require_permission("user", "create")),
    db: AsyncSession = Depends(get_db),
):
    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Check username uniqueness
    existing_u = await db.execute(select(User).where(User.username == payload.username))
    if existing_u.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken")

    role = await db.get(Role, payload.role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    password_helper = PasswordHelper()
    hashed = password_helper.hash(payload.password)

    user = User(
        email=payload.email,
        username=payload.username,
        first_name=payload.first_name,
        last_name=payload.last_name,
        hashed_password=hashed,
        is_active=True,
        is_superuser=False,
        is_verified=False,
    )
    db.add(user)
    await db.flush()

    db.add(UserRole(user_id=user.id, role_id=role.id, assigned_by=None))
    await audit_service.log_event(
        session=db,
        action=AuditActionEnum.user_created,
        resource_type="user",
        user_id=current_user.id,
        resource_id=user.id,
        resource_name=user.username,
        details={"email": user.email, "role": role.name},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return await _get_user_with_roles(user.id, db)


@router.patch("/users/{user_id}", response_model=UserWithRolesRead)
async def update_user(
    user_id: uuid.UUID,
    payload: UserPatch,
    request: Request,
    current_user: User = Depends(require_permission("user", "edit")),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    for field, value in data.items():
        setattr(user, field, value)
    if password:
        password_helper = PasswordHelper()
        user.hashed_password = password_helper.hash(password)
        await audit_service.log_event(
            session=db,
            action=AuditActionEnum.user_password_changed,
            resource_type="user",
            user_id=current_user.id,
            resource_id=user_id,
            resource_name=user.username,
            details={"changed_by": current_user.username},
            ip_address=request.client.host if request.client else None,
        )
    await db.commit()
    return await _get_user_with_roles(user_id, db)


@router.post("/users/{user_id}/assign-role", response_model=UserWithRolesRead)
async def assign_role(
    user_id: uuid.UUID,
    payload: AssignRoleBody,
    current_user: User = Depends(require_permission("user", "assign_roles")),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = await db.get(Role, payload.role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Replace all existing roles with the new one
    await db.execute(delete(UserRole).where(UserRole.user_id == user_id))
    db.add(UserRole(user_id=user_id, role_id=role.id, assigned_by=current_user.id))
    await audit_service.log_event(
        session=db,
        action=AuditActionEnum.user_role_assigned,
        resource_type="user",
        user_id=current_user.id,
        resource_id=user_id,
        resource_name=user.username,
        details={"role": role.name, "assigned_by": current_user.username},
    )
    await db.commit()

    return await _get_user_with_roles(user_id, db)


@router.delete("/users/{user_id}/deactivate", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_permission("user", "deactivate")),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await audit_service.log_event(
        session=db,
        action=AuditActionEnum.user_deactivated,
        resource_type="user",
        user_id=current_user.id,
        resource_id=user_id,
        resource_name=user.username,
        details={"email": user.email},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_permission("user", "delete")),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    username = user.username
    await db.delete(user)
    await audit_service.log_event(
        session=db,
        action=AuditActionEnum.user_deleted,
        resource_type="user",
        user_id=current_user.id,
        resource_id=user_id,
        resource_name=username,
        details={"deleted_by": current_user.username},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()


@router.get("/roles", response_model=list[RoleWithPermissionsRead])
async def list_roles(
    _: User = Depends(require_permission("user", "view")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Role).where(Role.is_active == True).order_by(Role.name))  # noqa: E712
    roles = result.scalars().all()
    out = []
    for role in roles:
        perms_result = await db.execute(
            select(Permission.resource, Permission.action)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role.id)
            .order_by(Permission.resource, Permission.action)
        )
        perms = [f"{r}:{a}" for r, a in perms_result.all()]
        out.append(RoleWithPermissionsRead(
            id=role.id,
            name=role.name,
            display_name=role.display_name,
            description=role.description,
            is_system_role=role.is_system_role,
            permissions=perms,
        ))
    return out
