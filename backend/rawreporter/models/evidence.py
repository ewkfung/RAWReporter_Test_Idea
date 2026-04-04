import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rawreporter.models.base import Base, TimestampMixin, UUIDMixin
from rawreporter.utils.enums import FileTypeEnum, ProtectionAdequacyEnum

if TYPE_CHECKING:
    from rawreporter.models.finding import Finding


class Evidence(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "evidence"

    finding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("findings.id", ondelete="CASCADE"), nullable=False
    )
    file_type: Mapped[FileTypeEnum] = mapped_column(
        SAEnum(FileTypeEnum, name="filetypeenum"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    protection_adequacy: Mapped[ProtectionAdequacyEnum | None] = mapped_column(
        SAEnum(ProtectionAdequacyEnum, name="protectionadequacyenum"), nullable=True
    )

    finding: Mapped["Finding"] = relationship(back_populates="evidence")
