import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.database import get_db
from rawreporter.dependencies import require_permission
from rawreporter.models.audit_log import AuditLog
from rawreporter.utils.enums import AuditActionEnum

router = APIRouter(prefix="/audit-logs", tags=["audit"])


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    action: AuditActionEnum
    resource_type: str
    resource_id: uuid.UUID | None
    resource_name: str | None
    details: dict | None
    ip_address: str | None
    created_at: datetime


@router.get("", response_model=list[AuditLogRead])
async def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    action: Optional[AuditActionEnum] = Query(default=None),
    user_id: Optional[uuid.UUID] = Query(default=None),
    from_date: Optional[str] = Query(default=None, description="ISO date string, e.g. 2026-01-01"),
    to_date: Optional[str] = Query(default=None, description="ISO date string, e.g. 2026-12-31"),
    _: User = Depends(require_permission("audit_log", "view")),
    db: AsyncSession = Depends(get_db),
):
    q = select(AuditLog).order_by(AuditLog.created_at.desc())

    if action:
        q = q.where(AuditLog.action == action)
    if user_id:
        q = q.where(AuditLog.user_id == user_id)
    if from_date:
        q = q.where(AuditLog.created_at >= datetime.fromisoformat(from_date))
    if to_date:
        q = q.where(AuditLog.created_at <= datetime.fromisoformat(to_date))

    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()
