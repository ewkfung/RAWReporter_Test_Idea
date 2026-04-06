/**
 * reports.ts — All API calls relating to reports.
 *
 * Reports can exist independently of an engagement (engagement_id is nullable).
 * The typical lifecycle is:
 *   1. Create a report (optionally linked to an engagement)
 *   2. Build it out in the Report Builder (/reports/:id/build)
 *   3. Archive when complete, or delete to permanently remove it
 *
 * Link / unlink lets consultants attach existing unlinked reports to an
 * engagement from the Engagements page without recreating them.
 */

import { apiClient } from "./client";
import type { Report, ReportSection } from "../types/models";

// ── Fetch ──────────────────────────────────────────────────────────────────

/** Returns all active (non-archived) reports. Pass engagementId to filter. */
export async function getReports(engagementId?: string): Promise<Report[]> {
  const res = await apiClient.get<Report[]>("/reports", {
    params: engagementId ? { engagement_id: engagementId } : undefined,
  });
  return res.data;
}

/**
 * Returns reports that have no engagement linked (engagement_id is null).
 * Used to populate the "Add Report" picker on the Engagements page.
 */
export async function getUnlinkedReports(): Promise<Report[]> {
  const res = await apiClient.get<Report[]>("/reports", { params: { unlinked: true } });
  return res.data;
}

/** Returns reports that have been archived, for the Archive page. */
export async function getArchivedReports(): Promise<Report[]> {
  const res = await apiClient.get<Report[]>("/reports/archived");
  return res.data;
}

/** Returns a single report by ID. */
export async function getReport(id: string): Promise<Report> {
  const res = await apiClient.get<Report>(`/reports/${id}`);
  return res.data;
}

// ── Create / update ────────────────────────────────────────────────────────

/** Creates a new report. engagement_id is optional — reports can be unlinked. */
export async function createReport(data: {
  engagement_id?: string | null;
  title: string;
  status?: string;
  types?: string[];
  start_date?: string | null;
  end_date?: string | null;
  completed_date?: string | null;
}): Promise<Report> {
  const res = await apiClient.post<Report>("/reports", data);
  return res.data;
}

/** Partially updates a report. Only included fields are changed. */
export async function updateReport(
  id: string,
  data: {
    title?: string;
    status?: string;
    types?: string[];
    start_date?: string | null;
    end_date?: string | null;
    completed_date?: string | null;
    engagement_id?: string | null;
  }
): Promise<Report> {
  const res = await apiClient.patch<Report>(`/reports/${id}`, data);
  return res.data;
}

// ── Link / unlink ──────────────────────────────────────────────────────────

/**
 * Links an unlinked report to an engagement.
 * Called when a consultant selects reports via the "Add Report" picker.
 */
export async function linkReport(id: string, engagementId: string): Promise<Report> {
  const res = await apiClient.post<Report>(`/reports/${id}/link`, { engagement_id: engagementId });
  return res.data;
}

/**
 * Removes a report's engagement association (sets engagement_id to null).
 * Report data is fully preserved — it just becomes unlinked.
 */
export async function unlinkReport(id: string): Promise<Report> {
  const res = await apiClient.post<Report>(`/reports/${id}/unlink`);
  return res.data;
}

// ── Archive / restore / delete ─────────────────────────────────────────────

/** Soft-archives a report. It is hidden from the main list but recoverable. */
export async function archiveReport(id: string): Promise<Report> {
  const res = await apiClient.post<Report>(`/reports/${id}/archive`);
  return res.data;
}

/** Restores a previously archived report back to the active list. */
export async function restoreReport(id: string): Promise<Report> {
  const res = await apiClient.post<Report>(`/reports/${id}/restore`);
  return res.data;
}

/** Permanently deletes a report and all its sections and findings. */
export async function deleteReport(id: string): Promise<void> {
  await apiClient.delete(`/reports/${id}`);
}

// ── Sections / generation ──────────────────────────────────────────────────

/** Returns the ordered list of sections for a report (used by the Report Builder). */
export async function getReportSections(reportId: string): Promise<ReportSection[]> {
  const res = await apiClient.get<ReportSection[]>(`/reports/${reportId}/sections`);
  return res.data;
}

export interface GenerateResponse {
  status: string;
  message: string;
  report_id: string;
}

/**
 * Triggers DOCX generation for a report (Phase 4 — deferred).
 * Currently returns a placeholder response.
 */
export async function generateReport(reportId: string): Promise<GenerateResponse> {
  const res = await apiClient.post<GenerateResponse>(`/reports/${reportId}/generate`);
  return res.data;
}
