import { apiClient } from "./client";
import type { AuditAction, AuditLog } from "../types/models";

export interface AuditLogFilters {
  limit?: number;
  offset?: number;
  action?: AuditAction;
  user_id?: string;
  from_date?: string;
  to_date?: string;
}

export async function listAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
  const params: Record<string, string | number> = {};
  if (filters.limit !== undefined) params.limit = filters.limit;
  if (filters.offset !== undefined) params.offset = filters.offset;
  if (filters.action !== undefined) params.action = filters.action;
  if (filters.user_id !== undefined) params.user_id = filters.user_id;
  if (filters.from_date !== undefined) params.from_date = filters.from_date;
  if (filters.to_date !== undefined) params.to_date = filters.to_date;

  const res = await apiClient.get<AuditLog[]>("/audit-logs", { params });
  return res.data;
}
