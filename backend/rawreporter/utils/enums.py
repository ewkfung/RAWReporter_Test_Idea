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
    tabletop = "tabletop"
    tsa_directive = "tsa_directive"
    compliance_assessment = "compliance_assessment"


class EngagementStatusEnum(str, Enum):
    scoping = "scoping"
    active = "active"
    in_review = "in_review"
    delivered = "delivered"
    closed = "closed"


class ReportStatusEnum(str, Enum):
    draft = "draft"
    review = "review"
    editing = "editing"
    final_review = "final_review"
    complete = "complete"


class SectionTypeEnum(str, Enum):
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
