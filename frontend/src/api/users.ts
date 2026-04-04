import { apiClient } from "./client";

export interface RoleRead {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system_role: boolean;
}

export interface RoleWithPermissionsRead extends RoleRead {
  permissions: string[];
}

export interface UserWithRoles {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: string;
  roles: RoleRead[];
}

export async function listUsers(): Promise<UserWithRoles[]> {
  const res = await apiClient.get<UserWithRoles[]>("/users");
  return res.data;
}

export async function createUser(data: {
  email: string;
  password: string;
  username: string;
  first_name?: string;
  last_name?: string;
  role_id: string;
}): Promise<UserWithRoles> {
  const res = await apiClient.post<UserWithRoles>("/users", data);
  return res.data;
}

export async function assignRole(userId: string, roleId: string): Promise<UserWithRoles> {
  const res = await apiClient.post<UserWithRoles>(`/users/${userId}/assign-role`, {
    role_id: roleId,
  });
  return res.data;
}

export async function updateUser(
  userId: string,
  data: Partial<{
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    password: string;
  }>
): Promise<UserWithRoles> {
  const res = await apiClient.patch<UserWithRoles>(`/users/${userId}`, data);
  return res.data;
}

export async function deactivateUser(userId: string): Promise<void> {
  await apiClient.delete(`/users/${userId}/deactivate`);
}

export async function deleteUser(userId: string): Promise<void> {
  await apiClient.delete(`/users/${userId}`);
}

export async function listRoles(): Promise<RoleWithPermissionsRead[]> {
  const res = await apiClient.get<RoleWithPermissionsRead[]>("/roles");
  return res.data;
}
