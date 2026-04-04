import { useAuthStore } from "../store/authStore";

export function usePermission(resource: string, action: string): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  return permissions.includes(`${resource}:${action}`);
}

export function usePermissions(
  checks: Array<{ resource: string; action: string }>
): Record<string, boolean> {
  const permissions = useAuthStore((s) => s.permissions);
  return Object.fromEntries(
    checks.map(({ resource, action }) => [
      `${resource}:${action}`,
      permissions.includes(`${resource}:${action}`),
    ])
  );
}
