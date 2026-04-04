import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rawreporter.models.base import Base, TimestampMixin, UUIDMixin
from rawreporter.utils.enums import RefTypeEnum

if TYPE_CHECKING:
    from rawreporter.models.finding import Finding


class FindingReference(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "finding_references"

    finding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("findings.id", ondelete="CASCADE"), nullable=False
    )
    ref_type: Mapped[RefTypeEnum] = mapped_column(
        SAEnum(RefTypeEnum, name="reftypeenum"), nullable=False
    )
    identifier: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    finding: Mapped["Finding"] = relationship(back_populates="references")
