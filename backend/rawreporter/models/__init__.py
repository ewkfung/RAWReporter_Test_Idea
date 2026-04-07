# Import all models so Base.metadata knows about them (required for Alembic autogenerate)
from rawreporter.models.client import Client
from rawreporter.models.document_template import DocumentTemplate
from rawreporter.models.engagement import Engagement
from rawreporter.models.evidence import Evidence
from rawreporter.models.finding import Finding
from rawreporter.models.finding_reference import FindingReference
from rawreporter.models.library_finding import LibraryFinding
from rawreporter.models.library_finding_reference import LibraryFindingReference
from rawreporter.models.permission import Permission
from rawreporter.models.report import Report
from rawreporter.models.report_default_template import ReportDefaultTemplate
from rawreporter.models.report_section import ReportSection
from rawreporter.models.role import Role
from rawreporter.models.platform_setting import PlatformSetting
from rawreporter.models.role_permission import RolePermission
from rawreporter.models.user_role import UserRole

__all__ = [
    "Client",
    "DocumentTemplate",
    "Engagement",
    "Evidence",
    "Finding",
    "FindingReference",
    "LibraryFinding",
    "LibraryFindingReference",
    "Permission",
    "PlatformSetting",
    "Report",
    "ReportDefaultTemplate",
    "ReportSection",
    "Role",
    "RolePermission",
    "UserRole",
]
