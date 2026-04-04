import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from rawreporter.utils.enums import ReportStatusEnum

# Re-exported so routers can import ReportSectionRead from here
from rawreporter.schemas.report_section import ReportSectionRead  # noqa: F401


class ReportBase(BaseModel):
    """
    Shared fields used by both create and read schemas.
    engagement_id is optional — a report can be created without an engagement
    and linked to one later via the /link endpoint.
    """

    model_config = ConfigDict(from_attributes=True)

    engagement_id: uuid.UUID | None = None
    title: str
    status: ReportStatusEnum = ReportStatusEnum.draft
    types: list[str] = []      # Assessment types, e.g. ["pentest"]
    start_date: date | None = None
    due_date: date | None = None


class ReportCreate(ReportBase):
    """All fields from ReportBase are sufficient for creation."""
    pass


class ReportUpdate(BaseModel):
    """
    All fields are optional — only supplied fields are updated (PATCH semantics).
    engagement_id can be set here to re-link a report to a different engagement.
    """

    model_config = ConfigDict(from_attributes=True)

    title: str | None = None
    status: ReportStatusEnum | None = None
    types: list[str] | None = None
    start_date: date | None = None
    due_date: date | None = None
    engagement_id: uuid.UUID | None = None


class ReportRead(ReportBase):
    """Full report representation returned by the API, including server-set fields."""

    id: uuid.UUID
    is_archived: bool
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
