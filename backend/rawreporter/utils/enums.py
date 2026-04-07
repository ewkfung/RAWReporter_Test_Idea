from enum import Enum


class SeverityEnum(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    informational = "informational"


class EngagementTypeEnum(str, Enum):
    pentest = "pentest"
    gap_assessment = "gap_assessment"
    vulnerability_assessment = "vulnerability_assessment"
    tabletop = "tabletop"          # legacy — hidden from UI, no builder yet
    tsa_directive = "tsa_directive"  # legacy — hidden from UI, no builder yet
    compliance_assessment = "compliance_assessment"
    risk = "risk"


class EngagementStatusEnum(str, Enum):
    scoping = "scoping"
    active = "active"
    in_review = "in_review"
    delivered = "delivered"
    completed = "completed"
    closed = "closed"


class ReportStatusEnum(str, Enum):
    draft = "draft"
    review = "review"
    editing = "editing"
    final_review = "final_review"
    complete = "complete"


class SectionTypeEnum(str, Enum):
    # Original section types (all reports)
    executive_summary = "executive_summary"
    findings_summary = "findings_summary"
    crown_jewel = "crown_jewel"
    critical_findings = "critical_findings"
    high_findings = "high_findings"
    medium_findings = "medium_findings"
    low_findings = "low_findings"
    informational = "informational"
    closing = "closing"
    appendix = "appendix"
    # Builder section types
    findings = "findings"
    report_title = "report_title"
    scope_and_methodology = "scope_and_methodology"
    scope_and_rules_of_engagement = "scope_and_rules_of_engagement"
    methodology = "methodology"
    attack_path = "attack_path"
    risk_assessment_approach = "risk_assessment_approach"
    risk_assessment_result = "risk_assessment_result"
    compliance_framework_overview = "compliance_framework_overview"
    compliance_maturity = "compliance_maturity"
    gap_analysis = "gap_analysis"
    remediation_roadmap = "remediation_roadmap"


class RefTypeEnum(str, Enum):
    cve = "cve"
    cwe = "cwe"
    cisa = "cisa"
    nist = "nist"
    nvd = "nvd"
    manufacturer = "manufacturer"


class FileTypeEnum(str, Enum):
    image = "image"
    log = "log"
    config = "config"
    pcap = "pcap"
    other = "other"


class ProtectionAdequacyEnum(str, Enum):
    adequate = "adequate"
    partial = "partial"
    inadequate = "inadequate"
    unknown = "unknown"


class AuditActionEnum(str, Enum):
    user_login = "user_login"
    client_viewed = "client_viewed"
    client_archived = "client_archived"
    client_restored = "client_restored"
    client_deleted = "client_deleted"
    engagement_viewed = "engagement_viewed"
    engagement_archived = "engagement_archived"
    engagement_restored = "engagement_restored"
    engagement_deleted = "engagement_deleted"
    report_viewed = "report_viewed"
    report_archived = "report_archived"
    report_restored = "report_restored"
    report_deleted = "report_deleted"
    library_finding_archived = "library_finding_archived"
    library_finding_restored = "library_finding_restored"
    library_finding_deleted = "library_finding_deleted"
    finding_deleted = "finding_deleted"
    evidence_deleted = "evidence_deleted"
    user_created = "user_created"
    user_deactivated = "user_deactivated"
    user_deleted = "user_deleted"
    user_role_assigned = "user_role_assigned"
    user_password_changed = "user_password_changed"
