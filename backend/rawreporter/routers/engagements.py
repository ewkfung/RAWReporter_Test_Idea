from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.database import get_db
from rawreporter.dependencies import require_permission
from rawreporter.models.client import Client
from rawreporter.models.engagement import Engagement
from rawreporter.schemas.engagement import EngagementCreate, EngagementRead, EngagementUpdate

router = APIRouter(prefix="/engagements", tags=["engagements"])


@router.get("", response_model=list[EngagementRead])
async def list_engagements(
    client_id: UUID | None = None,
    _: User = Depends(require_permission("engagement", "view")),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Engagement)
        .where(Engagement.is_archived == False)  # noqa: E712
        .order_by(Engagement.updated_at.desc())
    )
    if client_id:
        q = q.where(Engagement.client_id == client_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/archived", response_model=list[EngagementRead])
async def list_archived_engagements(
    _: User = Depends(require_permission("engagement", "archive")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Engagement)
        .where(Engagement.is_archived == True)  # noqa: E712
        .order_by(Engagement.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=EngagementRead, status_code=status.HTTP_201_CREATED)
async def create_engagement(
    payload: EngagementCreate,
    _: User = Depends(require_permission("engagement", "create")),
    db: AsyncSession = Depends(get_db),
):
    client = await db.get(Client, payload.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    data = payload.model_dump()
    # Serialize enum values in types list to strings for JSONB
    data["types"] = [t.value if hasattr(t, "value") else t for t in data["types"]]
    engagement = Engagement(**data)
    db.add(engagement)
    await db.commit()
    await db.refresh(engagement)
    return engagement


@router.get("/{engagement_id}", response_model=EngagementRead)
async def get_engagement(
    engagement_id: UUID,
    _: User = Depends(require_permission("engagement", "view")),
    db: AsyncSession = Depends(get_db),
):
    engagement = await db.get(Engagement, engagement_id)
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    return engagement


@router.patch("/{engagement_id}", response_model=EngagementRead)
async def update_engagement(
    engagement_id: UUID,
    payload: EngagementUpdate,
    _: User = Depends(require_permission("engagement", "edit")),
    db: AsyncSession = Depends(get_db),
):
    engagement = await db.get(Engagement, engagement_id)
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    data = payload.model_dump(exclude_unset=True)
    if "types" in data:
        data["types"] = [t.value if hasattr(t, "value") else t for t in data["types"]]
    for field, value in data.items():
        setattr(engagement, field, value)
    await db.commit()
    await db.refresh(engagement)
    return engagement


@router.post("/{engagement_id}/archive", response_model=EngagementRead)
async def archive_engagement(
    engagement_id: UUID,
    _: User = Depends(require_permission("engagement", "archive")),
    db: AsyncSession = Depends(get_db),
):
    engagement = await db.get(Engagement, engagement_id)
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    engagement.is_archived = True
    engagement.archived_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(engagement)
    return engagement


@router.post("/{engagement_id}/restore", response_model=EngagementRead)
async def restore_engagement(
    engagement_id: UUID,
    _: User = Depends(require_permission("engagement", "archive")),
    db: AsyncSession = Depends(get_db),
):
    engagement = await db.get(Engagement, engagement_id)
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    engagement.is_archived = False
    engagement.archived_at = None
    await db.commit()
    await db.refresh(engagement)
    return engagement


@router.delete("/{engagement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_engagement(
    engagement_id: UUID,
    _: User = Depends(require_permission("engagement", "delete")),
    db: AsyncSession = Depends(get_db),
):
    engagement = await db.get(Engagement, engagement_id)
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    await db.delete(engagement)
    await db.commit()
