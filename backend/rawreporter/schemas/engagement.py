import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from rawreporter.utils.enums import EngagementStatusEnum, EngagementTypeEnum


class EngagementBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    client_id: uuid.UUID
    title: str
    types: list[EngagementTypeEnum] = []
    status: EngagementStatusEnum = EngagementStatusEnum.scoping
    start_date: date | None = None
    end_date: date | None = None
    scope_description: str | None = None
    engagement_lead: str | None = None


class EngagementCreate(EngagementBase):
    pass


class EngagementUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str | None = None
    types: list[EngagementTypeEnum] | None = None
    status: EngagementStatusEnum | None = None
    start_date: date | None = None
    end_date: date | None = None
    scope_description: str | None = None
    engagement_lead: str | None = None


class EngagementRead(EngagementBase):
    id: uuid.UUID
    is_archived: bool
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
