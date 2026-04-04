import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from rawreporter.utils.enums import SectionTypeEnum, SeverityEnum


class ReportSectionBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report_id: uuid.UUID
    section_type: SectionTypeEnum
    severity_filter: SeverityEnum | None = None
    position: int = 0
    is_visible: bool = True
    title: str | None = None
    body_text: str | None = None


class ReportSectionCreate(ReportSectionBase):
    pass


class ReportSectionUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str | None = None
    is_visible: bool | None = None
    position: int | None = None
    body_text: str | None = None


class ReportSectionRead(ReportSectionBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
