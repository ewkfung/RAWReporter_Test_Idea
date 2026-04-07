import { apiClient } from "./client";

export interface TemplateEntry {
  engagement_type: string;
  section_type: string;
  title: string;
  default_body: string | null;
  updated_at: string | null;
}

export async function getTemplatesForType(engagementType: string): Promise<TemplateEntry[]> {
  const res = await apiClient.get<TemplateEntry[]>(`/templates/${engagementType}`);
  return res.data;
}

export async function upsertTemplate(
  engagementType: string,
  sectionType: string,
  defaultBody: string | null
): Promise<TemplateEntry> {
  const res = await apiClient.put<TemplateEntry>(
    `/templates/${engagementType}/${sectionType}`,
    { default_body: defaultBody }
  );
  return res.data;
}
