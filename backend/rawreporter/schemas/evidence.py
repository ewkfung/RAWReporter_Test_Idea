import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from rawreporter.utils.enums import FileTypeEnum, ProtectionAdequacyEnum


class EvidenceBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    finding_id: uuid.UUID
    file_type: FileTypeEnum
    filename: str
    file_path: str
    caption: str | None = None
    protection_adequacy: ProtectionAdequacyEnum | None = None


class EvidenceCreate(EvidenceBase):
    pass


class EvidenceRead(EvidenceBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
