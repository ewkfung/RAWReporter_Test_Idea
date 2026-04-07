import uuid

from sqlalchemy import BigInteger, Boolean, Enum as SAEnum, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from rawreporter.models.base import Base, TimestampMixin, UUIDMixin
from rawreporter.utils.enums import EngagementTypeEnum


class DocumentTemplate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "document_templates"

    __table_args__ = (
        UniqueConstraint("engagement_type", name="uq_document_template_engagement_type"),
    )

    engagement_type: Mapped[EngagementTypeEnum] = mapped_column(
        SAEnum(EngagementTypeEnum, name="engagementtypeenum", create_type=False),
        nullable=False,
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
