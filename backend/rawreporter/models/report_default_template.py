import uuid

from sqlalchemy import Enum as SAEnum, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from rawreporter.models.base import Base, TimestampMixin, UUIDMixin
from rawreporter.utils.enums import EngagementTypeEnum, SectionTypeEnum


class ReportDefaultTemplate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "report_default_templates"

    __table_args__ = (
        UniqueConstraint("engagement_type", "section_type", name="uq_template_engagement_section"),
    )

    # Stored as VARCHAR — engagement types are JSONB in the engagements table,
    # there is no PostgreSQL engagementtypeenum type.
    engagement_type: Mapped[str] = mapped_column(String(64), nullable=False)
    section_type: Mapped[SectionTypeEnum] = mapped_column(
        SAEnum(SectionTypeEnum, name="sectiontypeenum", create_type=False),
        nullable=False,
    )
    default_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    @property
    def engagement_type_enum(self) -> EngagementTypeEnum:
        return EngagementTypeEnum(self.engagement_type)
