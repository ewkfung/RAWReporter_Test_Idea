// ── Enums ──────────────────────────────────────────────────────────────────

export type Severity = "critical" | "high" | "medium" | "low" | "informational";

export type EngagementType =
  | "pentest"
  | "gap_assessment"
  | "vulnerability_assessment"
  | "tabletop"       // legacy — hidden from UI, no builder yet
  | "tsa_directive"  // legacy — hidden from UI, no builder yet
  | "compliance_assessment"
  | "risk";

export type EngagementStatus =
  | "scoping"
  | "active"
  | "in_review"
  | "delivered"
  | "completed"
  | "closed";

// Report workflow progresses: draft → review → editing → final_review → complete
export type ReportStatus = "draft" | "review" | "editing" | "final_review" | "complete";

export type SectionType =
  | "executive_summary"
  | "findings_summary"
  | "crown_jewel"
  | "critical_findings"
  | "high_findings"
  | "medium_findings"
  | "low_findings"
  | "informational"
  | "closing"
  | "appendix"
  // Builder section types
  | "findings"
  | "report_title"
  | "scope_and_methodology"
  | "scope_and_rules_of_engagement"
  | "methodology"
  | "attack_path"
  | "risk_assessment_approach"
  | "risk_assessment_result"
  | "compliance_framework_overview"
  | "compliance_maturity"
  | "gap_analysis"
  | "remediation_roadmap";

export type RefType = "cve" | "cwe" | "cisa" | "nist" | "nvd" | "manufacturer";

export type FileType = "image" | "log" | "config" | "pcap" | "other";

// ── Domain models ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
}

export type ClientStatus = "active" | "on_hold" | "inactive" | "to_be_archived";

export interface AdditionalContact {
  name: string;
  email: string;
}

export interface Client {
  id: string;
  name: string;
  company_name: string;
  industry_vertical: string;
  company_address: string;
  additional_contacts: AdditionalContact[];
  client_status: ClientStatus;
  primary_contact: string;
  contact_email: string;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Engagement {
  id: string;
  client_id: string;
  title: string;
  types: EngagementType[];
  status: EngagementStatus;
  start_date: string | null;
  end_date: string | null;
  completed_date: string | null;
  scope_description: string | null;
  engagement_lead_id: string | null;
  consultant_ids: string[];
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  // Nullable — a report can exist unlinked and be attached to an engagement later
  engagement_id: string | null;
  title: string;
  status: ReportStatus;
  types: string[];          // Assessment types, e.g. ["pentest"]
  start_date: string | null;
  end_date: string | null;
  completed_date: string | null;
  // Soft-archive: hides from the main list but data is preserved
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportSection {
  id: string;
  report_id: string;
  section_type: SectionType;
  severity_filter: Severity | null;
  position: number;
  is_visible: boolean;
  title: string | null;
  body_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface FindingReference {
  id: string;
  finding_id: string;
  ref_type: RefType;
  identifier: string;
  url: string | null;
  description: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Finding {
  id: string;
  report_id: string;
  section_id: string;
  library_finding_id: string | null;
  title: string;
  summary: string;
  observation: string;
  description_technical: string;
  description_executive: string;
  severity_default: Severity;
  severity_override: Severity | null;
  severity_effective: Severity; // computed: severity_override ?? severity_default
  cvss_score_default: number | null;
  cvss_score_override: number | null;
  recommendation: string;
  remediation_steps: string;
  remediation_steps_enabled: boolean;
  is_placement_override: boolean;
  override_justification: string | null;
  position: number;
  is_ot_specific: boolean;
  ref_cve_enabled: boolean;
  ref_cwe_enabled: boolean;
  ref_cisa_enabled: boolean;
  ref_nist_enabled: boolean;
  ref_nvd_enabled: boolean;
  ref_manufacturer_enabled: boolean;
  references: FindingReference[];
  created_at: string;
  updated_at: string;
}

export interface LibraryFindingReference {
  id: string;
  library_finding_id: string;
  ref_type: RefType;
  identifier: string;
  url: string | null;
  description: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface LibraryFinding {
  id: string;
  title: string;
  summary: string;
  observation: string;
  description_technical: string;
  description_executive: string;
  severity: Severity;
  cvss_score_default: number | null;
  recommendation: string;
  remediation_steps: string;
  remediation_steps_enabled: boolean;
  vertical: string;
  tags: string[];
  framework_refs: string[];
  questionnaire_trigger: string[];
  is_ot_specific: boolean;
  ref_cve_enabled: boolean;
  ref_cwe_enabled: boolean;
  ref_cisa_enabled: boolean;
  ref_nist_enabled: boolean;
  ref_nvd_enabled: boolean;
  ref_manufacturer_enabled: boolean;
  references: LibraryFindingReference[];
  is_archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Helper ─────────────────────────────────────────────────────────────────

export function severityEffective(f: Pick<Finding, "severity_default" | "severity_override">): Severity {
  return f.severity_override ?? f.severity_default;
}

// ── Audit Log ──────────────────────────────────────────────────────────────

export type AuditAction =
  | "user_login"
  | "client_viewed" | "client_archived" | "client_restored" | "client_deleted"
  | "engagement_viewed" | "engagement_archived" | "engagement_restored" | "engagement_deleted"
  | "report_viewed" | "report_archived" | "report_restored" | "report_deleted"
  | "library_finding_archived" | "library_finding_restored" | "library_finding_deleted"
  | "finding_deleted"
  | "evidence_deleted"
  | "user_created" | "user_deactivated" | "user_deleted"
  | "user_role_assigned" | "user_password_changed";

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: AuditAction;
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}
