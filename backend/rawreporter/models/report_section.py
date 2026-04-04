import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rawreporter.models.base import Base, TimestampMixin, UUIDMixin
from rawreporter.utils.enums import SectionTypeEnum, SeverityEnum

if TYPE_CHECKING:
    from rawreporter.models.finding import Finding
    from rawreporter.models.report import Report


class ReportSection(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "report_sections"

    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    section_type: Mapped[SectionTypeEnum] = mapped_column(
        SAEnum(SectionTypeEnum, name="sectiontypeenum"), nullable=False
    )
    severity_filter: Mapped[SeverityEnum | None] = mapped_column(
        SAEnum(SeverityEnum, name="severityenum"), nullable=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    report: Mapped["Report"] = relationship(back_populates="sections")
    findings: Mapped[list["Finding"]] = relationship(
        back_populates="section", cascade="all, delete-orphan", order_by="Finding.position"
    )
