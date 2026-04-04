import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from rawreporter.models.base import Base, TimestampMixin, UUIDMixin
from rawreporter.utils.enums import SeverityEnum

if TYPE_CHECKING:
    from rawreporter.models.evidence import Evidence
    from rawreporter.models.finding_reference import FindingReference
    from rawreporter.models.library_finding import LibraryFinding
    from rawreporter.models.report import Report
    from rawreporter.models.report_section import ReportSection


class Finding(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "findings"

    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("report_sections.id", ondelete="CASCADE"), nullable=False
    )
    library_finding_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("library_findings.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    observation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_technical: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_executive: Mapped[str] = mapped_column(Text, nullable=False, default="")

    severity_default: Mapped[SeverityEnum] = mapped_column(
        SAEnum(SeverityEnum, name="severityenum"), nullable=False
    )
    severity_override: Mapped[SeverityEnum | None] = mapped_column(
        SAEnum(SeverityEnum, name="severityenum"), nullable=True
    )
    severity_effective: Mapped[SeverityEnum] = mapped_column(
        SAEnum(SeverityEnum, name="severityenum"), nullable=False
    )

    cvss_score_default: Mapped[float | None] = mapped_column(Float, nullable=True)
    cvss_score_override: Mapped[float | None] = mapped_column(Float, nullable=True)

    recommendation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    remediation_steps: Mapped[str] = mapped_column(Text, nullable=False, default="")
    remediation_steps_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    is_placement_override: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    override_justification: Mapped[str | None] = mapped_column(Text, nullable=True)

    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_ot_specific: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    ref_cve_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ref_cwe_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ref_cisa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ref_nist_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ref_nvd_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ref_manufacturer_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    @validates("severity_default", "severity_override")
    def _sync_effective(self, key: str, value: SeverityEnum | None) -> SeverityEnum | None:
        if key == "severity_override":
            default = getattr(self, "severity_default", None)
            self.severity_effective = value if value is not None else default
        else:  # severity_default
            override = getattr(self, "severity_override", None)
            self.severity_effective = override if override is not None else value
        return value

    report: Mapped["Report"] = relationship(back_populates="findings")
    section: Mapped["ReportSection"] = relationship(back_populates="findings")
    library_finding: Mapped["LibraryFinding | None"] = relationship(back_populates="findings")
    references: Mapped[list["FindingReference"]] = relationship(
        back_populates="finding", cascade="all, delete-orphan", lazy="selectin"
    )
    evidence: Mapped[list["Evidence"]] = relationship(
        back_populates="finding", cascade="all, delete-orphan"
    )
