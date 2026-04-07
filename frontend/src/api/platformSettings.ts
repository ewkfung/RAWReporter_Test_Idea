import { apiClient } from "./client";

export async function getPlatformSettings(): Promise<Record<string, string | null>> {
  const res = await apiClient.get<Record<string, string | null>>("/platform-settings/");
  return res.data;
}

export async function updatePlatformSetting(key: string, value: string): Promise<void> {
  await apiClient.put(`/platform-settings/${key}`, { value });
}
