import logging
import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from rawreporter.models.audit_log import AuditLog
from rawreporter.utils.enums import AuditActionEnum

logger = logging.getLogger(__name__)


async def log_event(
    session: AsyncSession,
    action: AuditActionEnum,
    resource_type: str,
    user_id: Optional[uuid.UUID] = None,
    resource_id: Optional[uuid.UUID] = None,
    resource_name: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    """
    Append one audit event to audit_logs.
    Uses flush() so the row commits atomically with the caller's transaction.
    Errors are logged but never propagated — audit failures never break requests.
    """
    try:
        entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            details=details,
            ip_address=ip_address,
        )
        session.add(entry)
        await session.flush()
    except Exception:
        logger.exception("audit_service.log_event failed — audit write suppressed")
