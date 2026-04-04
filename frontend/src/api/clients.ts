import { apiClient } from "./client";
import type { Client } from "../types/models";

export async function getClients(): Promise<Client[]> {
  const res = await apiClient.get<Client[]>("/clients");
  return res.data;
}

export async function getArchivedClients(): Promise<Client[]> {
  const res = await apiClient.get<Client[]>("/clients/archived");
  return res.data;
}

export async function getClient(id: string): Promise<Client> {
  const res = await apiClient.get<Client>(`/clients/${id}`);
  return res.data;
}

export async function createClient(
  data: Omit<Client, "id" | "created_at" | "updated_at" | "is_archived" | "archived_at">
): Promise<Client> {
  const res = await apiClient.post<Client>("/clients", data);
  return res.data;
}

export async function updateClient(
  id: string,
  data: Partial<Omit<Client, "id" | "created_at" | "updated_at" | "is_archived" | "archived_at">>
): Promise<Client> {
  const res = await apiClient.patch<Client>(`/clients/${id}`, data);
  return res.data;
}

export async function archiveClient(id: string): Promise<Client> {
  const res = await apiClient.post<Client>(`/clients/${id}/archive`);
  return res.data;
}

export async function restoreClient(id: string): Promise<Client> {
  const res = await apiClient.post<Client>(`/clients/${id}/restore`);
  return res.data;
}

export async function deleteClient(id: string): Promise<void> {
  await apiClient.delete(`/clients/${id}`);
}
