from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.auth.models import User
from rawreporter.database import get_db
from rawreporter.dependencies import require_permission
from rawreporter.models.client import Client
from rawreporter.schemas.client import ClientCreate, ClientRead, ClientUpdate

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=list[ClientRead])
async def list_clients(
    _: User = Depends(require_permission("client", "view")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Client)
        .where(Client.is_archived == False)  # noqa: E712
        .order_by(Client.created_at.desc())
    )
    return result.scalars().all()


@router.get("/archived", response_model=list[ClientRead])
async def list_archived_clients(
    _: User = Depends(require_permission("client", "archive")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Client)
        .where(Client.is_archived == True)  # noqa: E712
        .order_by(Client.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate,
    _: User = Depends(require_permission("client", "create")),
    db: AsyncSession = Depends(get_db),
):
    data = payload.model_dump()
    # Serialize nested AdditionalContact objects to plain dicts for JSONB
    data["additional_contacts"] = [
        c if isinstance(c, dict) else c.model_dump()
        for c in data["additional_contacts"]
    ]
    client = Client(**data)
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientRead)
async def get_client(
    client_id: UUID,
    _: User = Depends(require_permission("client", "view")),
    db: AsyncSession = Depends(get_db),
):
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.patch("/{client_id}", response_model=ClientRead)
async def update_client(
    client_id: UUID,
    payload: ClientUpdate,
    _: User = Depends(require_permission("client", "edit")),
    db: AsyncSession = Depends(get_db),
):
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    data = payload.model_dump(exclude_unset=True)
    if "additional_contacts" in data:
        data["additional_contacts"] = [
            c if isinstance(c, dict) else c.model_dump()
            for c in data["additional_contacts"]
        ]
    for field, value in data.items():
        setattr(client, field, value)
    await db.commit()
    await db.refresh(client)
    return client


@router.post("/{client_id}/archive", response_model=ClientRead)
async def archive_client(
    client_id: UUID,
    _: User = Depends(require_permission("client", "archive")),
    db: AsyncSession = Depends(get_db),
):
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.is_archived = True
    client.archived_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(client)
    return client


@router.post("/{client_id}/restore", response_model=ClientRead)
async def restore_client(
    client_id: UUID,
    _: User = Depends(require_permission("client", "archive")),
    db: AsyncSession = Depends(get_db),
):
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.is_archived = False
    client.archived_at = None
    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: UUID,
    _: User = Depends(require_permission("client", "delete")),
    db: AsyncSession = Depends(get_db),
):
    client = await db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    await db.delete(client)
    await db.commit()
