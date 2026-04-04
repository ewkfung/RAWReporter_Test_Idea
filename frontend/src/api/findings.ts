import { apiClient } from "./client";
import type { Finding, Severity } from "../types/models";

export interface FindingsBySection {
  section: import("../types/models").ReportSection;
  findings: Finding[];
}

export async function getFindingsBySection(reportId: string): Promise<FindingsBySection[]> {
  const res = await apiClient.get<FindingsBySection[]>(
    `/reports/${reportId}/findings/by-section`
  );
  return res.data;
}

export async function getFinding(id: string): Promise<Finding> {
  const res = await apiClient.get<Finding>(`/findings/${id}`);
  return res.data;
}

export async function updateFinding(
  id: string,
  data: Partial<Pick<Finding,
    | "severity_override"
    | "override_justification"
    | "title"
    | "summary"
    | "observation"
    | "recommendation"
    | "remediation_steps"
    | "remediation_steps_enabled"
    | "cvss_score_override"
    | "ref_cve_enabled"
    | "ref_cwe_enabled"
    | "ref_cisa_enabled"
    | "ref_nist_enabled"
    | "ref_nvd_enabled"
    | "ref_manufacturer_enabled"
  >>
): Promise<Finding> {
  const res = await apiClient.patch<Finding>(`/findings/${id}`, data);
  return res.data;
}

export interface FindingRefUpsert {
  ref_type: "cve" | "cwe" | "cisa" | "nist" | "nvd" | "manufacturer";
  identifier: string;
  url?: string | null;
  description?: string | null;
  is_visible: boolean;
}

export async function replaceFindingReferences(
  id: string,
  refs: FindingRefUpsert[]
): Promise<Finding> {
  const res = await apiClient.put<Finding>(`/findings/${id}/references`, refs);
  return res.data;
}

export async function updateFindingSeverity(id: string, newSeverity: Severity): Promise<Finding> {
  const res = await apiClient.patch<Finding>(`/findings/${id}/severity`, {
    new_severity: newSeverity,
  });
  return res.data;
}

export async function moveFinding(
  id: string,
  targetSectionId: string,
  newPosition: number
): Promise<Finding> {
  const res = await apiClient.patch<Finding>(`/findings/${id}/move`, {
    target_section_id: targetSectionId,
    new_position: newPosition,
  });
  return res.data;
}

export async function reorderFinding(id: string, newPosition: number): Promise<Finding> {
  const res = await apiClient.patch<Finding>(`/findings/${id}/reorder`, {
    new_position: newPosition,
  });
  return res.data;
}

export async function deleteFinding(id: string): Promise<void> {
  await apiClient.delete(`/findings/${id}`);
}
