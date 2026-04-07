from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.database import get_db
from rawreporter.dependencies import require_permission
from rawreporter.models.platform_setting import PlatformSetting

router = APIRouter(prefix="/platform-settings", tags=["platform-settings"])


@router.get("/", response_model=dict[str, str | None])
async def get_platform_settings(
    _: User = Depends(require_permission("platform_setting", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Returns all platform settings as a key-value dict."""
    result = await db.execute(select(PlatformSetting))
    rows = result.scalars().all()
    return {row.key: row.value for row in rows}


@router.put("/{key}", response_model=dict[str, str | None])
async def update_platform_setting(
    key: str,
    value: str | None = Body(..., embed=True),
    current_user: User = Depends(require_permission("platform_setting", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """Upsert a platform setting value."""
    result = await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == key)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = PlatformSetting(key=key, value=value, updated_by=current_user.id)
        db.add(row)
    else:
        row.value = value
        row.updated_by = current_user.id
        row.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(row)
    return {row.key: row.value}
