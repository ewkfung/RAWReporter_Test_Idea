import { apiClient } from "./client";
import type { LibraryFinding, Severity } from "../types/models";

export interface ImportResult {
  finding: import("../types/models").Finding;
  section: import("../types/models").ReportSection;
}

export async function getLibraryFindings(params?: {
  vertical?: string;
  severity?: Severity;
  is_ot_specific?: boolean;
  search?: string;
}): Promise<LibraryFinding[]> {
  const res = await apiClient.get<LibraryFinding[]>("/library", { params });
  return res.data;
}

export async function getLibraryFinding(id: string): Promise<LibraryFinding> {
  const res = await apiClient.get<LibraryFinding>(`/library/${id}`);
  return res.data;
}

export async function createLibraryFinding(
  data: Omit<LibraryFinding, "id" | "created_at" | "updated_at" | "references">
): Promise<LibraryFinding> {
  const res = await apiClient.post<LibraryFinding>("/library", data);
  return res.data;
}

export async function updateLibraryFinding(
  id: string,
  data: Partial<Omit<LibraryFinding, "id" | "created_at" | "updated_at" | "references">>
): Promise<LibraryFinding> {
  const res = await apiClient.patch<LibraryFinding>(`/library/${id}`, data);
  return res.data;
}

export async function deleteLibraryFinding(id: string): Promise<void> {
  await apiClient.delete(`/library/${id}`);
}

export async function importLibraryFinding(
  libraryFindingId: string,
  reportId: string,
  targetSectionId?: string
): Promise<ImportResult> {
  const res = await apiClient.post<ImportResult>(`/library/${libraryFindingId}/import`, {
    report_id: reportId,
    target_section_id: targetSectionId ?? null,
  });
  return res.data;
}

export async function getArchivedLibraryFindings(): Promise<LibraryFinding[]> {
  const res = await apiClient.get<LibraryFinding[]>("/library/archived");
  return res.data;
}

export async function archiveLibraryFinding(id: string): Promise<LibraryFinding> {
  const res = await apiClient.post<LibraryFinding>(`/library/${id}/archive`);
  return res.data;
}

export async function restoreLibraryFinding(id: string): Promise<LibraryFinding> {
  const res = await apiClient.post<LibraryFinding>(`/library/${id}/restore`);
  return res.data;
}

export interface RefUpsert {
  ref_type: "cve" | "cwe" | "cisa" | "nist" | "nvd" | "manufacturer";
  identifier: string;
  url?: string | null;
  description?: string | null;
  is_visible: boolean;
}

export async function replaceLibraryFindingReferences(
  id: string,
  refs: RefUpsert[]
): Promise<void> {
  await apiClient.put(`/library/${id}/references`, refs);
}
