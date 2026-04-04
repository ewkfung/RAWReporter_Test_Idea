import { apiClient } from "./client";
import type { ReportSection } from "../types/models";

export async function updateSection(
  id: string,
  data: { title?: string; is_visible?: boolean; position?: number; body_text?: string }
): Promise<ReportSection> {
  const res = await apiClient.patch<ReportSection>(`/sections/${id}`, data);
  return res.data;
}
