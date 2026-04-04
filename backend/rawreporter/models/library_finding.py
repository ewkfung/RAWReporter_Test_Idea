import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rawreporter.models.base import Base, TimestampMixin, UUIDMixin
from rawreporter.utils.enums import SeverityEnum

if TYPE_CHECKING:
    from rawreporter.models.finding import Finding
    from rawreporter.models.library_finding_reference import LibraryFindingReference


class LibraryFinding(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "library_findings"

    title: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    observation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_technical: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_executive: Mapped[str] = mapped_column(Text, nullable=False, default="")
    severity: Mapped[SeverityEnum] = mapped_column(
        SAEnum(SeverityEnum, name="severityenum"), nullable=False
    )
    cvss_score_default: Mapped[float | None] = mapped_column(Float, nullable=True)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    remediation_steps: Mapped[str] = mapped_column(Text, nullable=False, default="")
    remediation_steps_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    vertical: Mapped[str] = mapped_column(String, nullable=False, default="")
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    framework_refs: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    questionnaire_trigger: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    is_ot_specific: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Archive fields
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Reference type visibility toggles
    ref_cve_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ref_cwe_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ref_cisa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ref_nist_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ref_nvd_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ref_manufacturer_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    references: Mapped[list["LibraryFindingReference"]] = relationship(
        back_populates="library_finding", cascade="all, delete-orphan", lazy="selectin"
    )
    findings: Mapped[list["Finding"]] = relationship(back_populates="library_finding")
