import { apiClient } from "./client";

export interface DocumentTemplateInfo {
  id: string;
  original_filename: string;
  file_size_bytes: number;
  uploaded_at: string;
  uploaded_by_name: string | null;
}

export interface DocumentTemplateStatus {
  engagement_type: string;
  display_name: string;
  template: DocumentTemplateInfo | null;
}

export async function getDocumentTemplates(): Promise<DocumentTemplateStatus[]> {
  const res = await apiClient.get<DocumentTemplateStatus[]>("/document-templates/");
  return res.data;
}

export async function uploadDocumentTemplate(
  engagementType: string,
  file: File
): Promise<DocumentTemplateStatus> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiClient.post<DocumentTemplateStatus>(
    `/document-templates/${engagementType}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data;
}

export async function deleteDocumentTemplate(engagementType: string): Promise<void> {
  await apiClient.delete(`/document-templates/${engagementType}`);
}
