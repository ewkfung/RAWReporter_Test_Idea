import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from rawreporter.utils.enums import RefTypeEnum


class LibraryFindingReferenceBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    library_finding_id: uuid.UUID
    ref_type: RefTypeEnum
    identifier: str
    url: str | None = None
    description: str | None = None
    is_visible: bool = True


class LibraryFindingReferenceCreate(LibraryFindingReferenceBase):
    pass


class LibraryFindingReferenceUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ref_type: RefTypeEnum | None = None
    identifier: str | None = None
    url: str | None = None
    description: str | None = None
    is_visible: bool | None = None


class LibraryFindingReferenceRead(LibraryFindingReferenceBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
