// ── Enums ──────────────────────────────────────────────────────────────────

export type Severity = "critical" | "high" | "medium" | "low" | "informational";

export type EngagementType =
  | "pentest"
  | "gap_assessment"
  | "vulnerability_assessment"
  | "tabletop"
  | "tsa_directive"
  | "compliance_assessment";

export type EngagementStatus =
  | "scoping"
  | "active"
  | "in_review"
  | "delivered"
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
  | "appendix";

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
  scope_description: string | null;
  engagement_lead: string | null;
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
  due_date: string | null;
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
