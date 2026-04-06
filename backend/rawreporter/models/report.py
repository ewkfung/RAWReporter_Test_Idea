import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rawreporter.models.base import Base, TimestampMixin, UUIDMixin
from rawreporter.utils.enums import ReportStatusEnum

# Avoid circular imports — these models are only referenced for type hints
if TYPE_CHECKING:
    from rawreporter.models.engagement import Engagement
    from rawreporter.models.finding import Finding
    from rawreporter.models.report_section import ReportSection


class Report(UUIDMixin, TimestampMixin, Base):
    """
    A report belongs to an engagement and contains sections and findings.

    engagement_id is nullable — a report can exist without being linked to an
    engagement (e.g. created standalone from the Reports page and linked later).
    When an engagement is deleted, its reports are unlinked (SET NULL) rather
    than cascade-deleted, preserving the report data.

    types stores the assessment type(s) as a JSONB array (e.g. ["pentest"]).
    is_archived / archived_at follow the same soft-delete pattern used across
    clients, engagements, and library findings.
    """

    __tablename__ = "reports"

    # Nullable FK — SET NULL when the parent engagement is deleted
    engagement_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("engagements.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)

    # Workflow status: draft → review → editing → final_review → complete
    status: Mapped[ReportStatusEnum] = mapped_column(
        SAEnum(ReportStatusEnum, name="reportstatusenum"),
        nullable=False,
        default=ReportStatusEnum.draft,
    )

    # Assessment types stored as a JSON array (e.g. ["pentest", "tabletop"])
    types: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Soft-archive — hides from the main list without permanent deletion
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ORM relationships
    engagement: Mapped["Engagement"] = relationship(back_populates="reports")

    # Sections and findings are hard-deleted when the report is deleted
    sections: Mapped[list["ReportSection"]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="ReportSection.position"
    )
    findings: Mapped[list["Finding"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )
