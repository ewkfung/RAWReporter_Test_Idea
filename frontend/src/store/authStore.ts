import { create } from "zustand";
import type { User } from "../types/models";

interface AuthState {
  token: string | null;
  user: User | null;
  permissions: string[];
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setPermissions: (permissions: string[]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("token"),
  user: null,
  permissions: [],

  setToken: (token) => {
    localStorage.setItem("token", token);
    set({ token });
  },

  setUser: (user) => set({ user }),

  setPermissions: (permissions) => set({ permissions }),

  logout: () => {
    localStorage.removeItem("token");
    set({ token: null, user: null, permissions: [] });
    window.location.href = "/login";
  },
}));
