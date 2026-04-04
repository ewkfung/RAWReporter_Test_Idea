import { apiClient } from "./client";
import type { Engagement } from "../types/models";

export async function getEngagements(clientId?: string): Promise<Engagement[]> {
  const res = await apiClient.get<Engagement[]>("/engagements", {
    params: clientId ? { client_id: clientId } : undefined,
  });
  return res.data;
}

export async function getArchivedEngagements(): Promise<Engagement[]> {
  const res = await apiClient.get<Engagement[]>("/engagements/archived");
  return res.data;
}

export async function getEngagement(id: string): Promise<Engagement> {
  const res = await apiClient.get<Engagement>(`/engagements/${id}`);
  return res.data;
}

export async function createEngagement(
  data: Omit<Engagement, "id" | "created_at" | "updated_at" | "is_archived" | "archived_at">
): Promise<Engagement> {
  const res = await apiClient.post<Engagement>("/engagements", data);
  return res.data;
}

export async function updateEngagement(
  id: string,
  data: Partial<Omit<Engagement, "id" | "created_at" | "updated_at" | "is_archived" | "archived_at">>
): Promise<Engagement> {
  const res = await apiClient.patch<Engagement>(`/engagements/${id}`, data);
  return res.data;
}

export async function archiveEngagement(id: string): Promise<Engagement> {
  const res = await apiClient.post<Engagement>(`/engagements/${id}/archive`);
  return res.data;
}

export async function restoreEngagement(id: string): Promise<Engagement> {
  const res = await apiClient.post<Engagement>(`/engagements/${id}/restore`);
  return res.data;
}

export async function deleteEngagement(id: string): Promise<void> {
  await apiClient.delete(`/engagements/${id}`);
}
