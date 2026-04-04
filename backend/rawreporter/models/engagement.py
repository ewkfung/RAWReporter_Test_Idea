import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rawreporter.models.base import Base, TimestampMixin, UUIDMixin
from rawreporter.utils.enums import EngagementStatusEnum

if TYPE_CHECKING:
    from rawreporter.models.client import Client
    from rawreporter.models.report import Report


class Engagement(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "engagements"

    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    # Multi-type: list of EngagementTypeEnum string values stored as JSONB
    types: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    status: Mapped[EngagementStatusEnum] = mapped_column(
        SAEnum(EngagementStatusEnum, name="engagementstatusenum"),
        nullable=False,
        default=EngagementStatusEnum.scoping,
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    scope_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    engagement_lead: Mapped[str | None] = mapped_column(String, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    client: Mapped["Client"] = relationship(back_populates="engagements")
    reports: Mapped[list["Report"]] = relationship(
        back_populates="engagement", cascade="all, delete-orphan"
    )
