import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from rawreporter.utils.enums import RefTypeEnum


class FindingReferenceBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    finding_id: uuid.UUID
    ref_type: RefTypeEnum
    identifier: str
    url: str | None = None
    description: str | None = None
    is_visible: bool = True


class FindingReferenceCreate(FindingReferenceBase):
    pass


class FindingReferenceUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ref_type: RefTypeEnum | None = None
    identifier: str | None = None
    url: str | None = None
    description: str | None = None
    is_visible: bool | None = None


class FindingReferenceRead(FindingReferenceBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
