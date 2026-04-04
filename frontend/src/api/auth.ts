import { apiClient } from "./client";
import type { User } from "../types/models";

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const res = await apiClient.post<LoginResponse>("/auth/jwt/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return res.data;
}

export async function register(data: {
  email: string;
  password: string;
  username: string;
  first_name: string;
  last_name: string;
}): Promise<User> {
  const res = await apiClient.post<User>("/auth/register", data);
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await apiClient.get<User>("/users/me");
  return res.data;
}

export async function fetchMyPermissions(): Promise<string[]> {
  const res = await apiClient.get<string[]>("/users/me/permissions");
  return res.data;
}
