from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rawreporter.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from rawreporter.models.engagement import Engagement


class Client(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "clients"

    name: Mapped[str] = mapped_column(String, nullable=False)
    company_name: Mapped[str] = mapped_column(String, nullable=False, default="")
    industry_vertical: Mapped[str] = mapped_column(String, nullable=False, default="")
    company_address: Mapped[str] = mapped_column(Text, nullable=False, default="")
    additional_contacts: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    client_status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    primary_contact: Mapped[str] = mapped_column(String, nullable=False, default="")
    contact_email: Mapped[str] = mapped_column(String, nullable=False, default="")
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    engagements: Mapped[list["Engagement"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
