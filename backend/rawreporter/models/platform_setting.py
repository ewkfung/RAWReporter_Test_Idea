import uuid

from sqlalchemy import String, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from rawreporter.models.base import Base, TimestampMixin, UUIDMixin


class PlatformSetting(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "platform_settings"

    __table_args__ = (
        Index("ix_platform_settings_key", "key", unique=True),
    )

    key: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
