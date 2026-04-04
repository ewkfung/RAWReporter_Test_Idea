import React from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { CreateUserModal } from "../../components/users/CreateUserModal";
import { EditUserModal } from "../../components/users/EditUserModal";
import { RoleSelectModal } from "../../components/users/RoleSelectModal";
import { ResetPasswordModal } from "../../components/users/ResetPasswordModal";
import { usePermission } from "../../hooks/usePermission";
import { useToast } from "../../components/ui/useToast";
import { useAuthStore } from "../../store/authStore";
import { listUsers, updateUser } from "../../api/users";
import type { UserWithRoles } from "../../api/users";
import type { BadgeVariant } from "../../components/ui/Badge";

// ── Role badge colour map ──────────────────────────────────────────────────

const ROLE_BADGE: Record<string, BadgeVariant> = {
  admin: "critical",
  lead: "blue",
  consultant: "success",
  view_only: "neutral",
};

function RoleBadge({ roleName, displayName }: { roleName: string; displayName: string }) {
  const variant: BadgeVariant = ROLE_BADGE[roleName] ?? "neutral";
  return <Badge variant={variant}>{displayName}</Badge>;
}

// ── Manage dropdown ────────────────────────────────────────────────────────

interface ManageDropdownProps {
  user: UserWithRoles;
  isCurrentUser: boolean;
  canEdit: boolean;
  canToggleActive: boolean;
  canAssignRoles: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onChangeRole: () => void;
  onResetPassword: () => void;
}

function ManageDropdown({
  user,
  isCurrentUser,
  canEdit,
  canToggleActive,
  canAssignRoles,
  onEdit,
  onToggleActive,
  onChangeRole,
  onResetPassword,
}: ManageDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items: Array<{ label: string; action: () => void; color?: string; hidden?: boolean }> = [
    { label: "Edit User", action: onEdit, hidden: !canEdit },
    {
      label: user.is_active ? "Disable User" : "Enable User",
      action: onToggleActive,
      color: user.is_active ? "var(--color-warning, #d97706)" : undefined,
      hidden: !canToggleActive || isCurrentUser,
    },
    { label: "Change Permission Role", action: onChangeRole, hidden: !canAssignRoles },
    { label: "Reset Password", action: onResetPassword, hidden: !canEdit },
  ].filter((item) => !item.hidden);

  if (items.length === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "4px 10px",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--color-gray-600)",
          background: "var(--color-gray-50)",
          border: "1px solid var(--color-gray-200)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        Manage
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            background: "var(--color-white)",
            border: "1px solid var(--color-gray-200)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
            zIndex: 300,
            minWidth: 180,
            overflow: "hidden",
          }}
        >
          {items.map(({ label, action, color }) => (
            <button
              key={label}
              onClick={() => { setOpen(false); action(); }}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 500,
                textAlign: "left",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: color ?? "var(--color-gray-700)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function UsersPage() {
  const canView = usePermission("user", "view");
  const canCreate = usePermission("user", "create");
  const canEdit = usePermission("user", "edit");
  const canAssignRoles = usePermission("user", "assign_roles");
  const canDeactivate = usePermission("user", "deactivate");

  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<UserWithRoles | null>(null);
  const [roleModalUser, setRoleModalUser] = React.useState<UserWithRoles | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = React.useState<UserWithRoles | null>(null);
  const [toggleActiveTarget, setToggleActiveTarget] = React.useState<UserWithRoles | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: canView,
  });

  if (!canView) return <Navigate to="/" replace />;

  const handleToggleActive = async () => {
    if (!toggleActiveTarget) return;
    await updateUser(toggleActiveTarget.id, { is_active: !toggleActiveTarget.is_active });
    queryClient.invalidateQueries({ queryKey: ["users"] });
    toast.success(toggleActiveTarget.is_active ? "User disabled" : "User enabled");
    setToggleActiveTarget(null);
  };

  const actions = canCreate ? (
    <Button variant="primary" onClick={() => setCreateOpen(true)}>
      + Create User
    </Button>
  ) : undefined;

  return (
    <PageWrapper title="User Management" actions={actions}>
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <Spinner size={32} />
        </div>
      ) : (
        <div
          style={{
            background: "var(--color-white)",
            border: "1px solid var(--color-gray-200)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          {/* Table header */}
          <div style={rowStyle(true)}>
            <span style={colHeader("2fr")}>Username / Name</span>
            <span style={colHeader("2fr")}>Email</span>
            <span style={colHeader("1fr")}>Role</span>
            <span style={colHeader("1fr")}>Status</span>
            <span style={colHeader("1fr")}>Joined</span>
            <span style={colHeader("120px")}>Actions</span>
          </div>

          {users.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--color-gray-400)", fontSize: 13 }}>
              No users found.
            </div>
          ) : (
            users.map((user, idx) => {
              const role = user.roles[0];
              const isCurrentUser = user.id === currentUser?.id;
              const joinedDate = new Date(user.created_at).toLocaleDateString();
              const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");

              return (
                <div key={user.id} style={rowStyle(false, idx === users.length - 1)}>
                  {/* Username + full name */}
                  <div style={colCell("2fr")}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>
                      {user.username}
                    </span>
                    {fullName && (
                      <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>
                        {fullName}
                      </span>
                    )}
                  </div>

                  {/* Email */}
                  <div style={colCell("2fr")}>
                    <span style={{ fontSize: 13, color: "var(--color-gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{user.email}</span>
                  </div>

                  {/* Role */}
                  <div style={colCell("1fr")}>
                    {role ? (
                      <RoleBadge roleName={role.name} displayName={role.display_name} />
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>No role</span>
                    )}
                  </div>

                  {/* Status */}
                  <div style={colCell("1fr")}>
                    <Badge variant={user.is_active ? "success" : "neutral"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {/* Joined */}
                  <div style={colCell("1fr")}>
                    <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>{joinedDate}</span>
                  </div>

                  {/* Actions */}
                  <div style={{ ...colCell("120px"), justifyContent: "flex-end" }}>
                    <ManageDropdown
                      user={user}
                      isCurrentUser={isCurrentUser}
                      canEdit={canEdit}
                      canToggleActive={canDeactivate}
                      canAssignRoles={canAssignRoles}
                      onEdit={() => setEditTarget(user)}
                      onToggleActive={() => setToggleActiveTarget(user)}
                      onChangeRole={() => setRoleModalUser(user)}
                      onResetPassword={() => setResetPasswordTarget(user)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <CreateUserModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(roleName) => {
          setCreateOpen(false);
          queryClient.invalidateQueries({ queryKey: ["users"] });
          toast.success(`User created and assigned ${roleName} role`);
        }}
      />

      <EditUserModal
        isOpen={editTarget !== null}
        user={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          queryClient.invalidateQueries({ queryKey: ["users"] });
          toast.success("User updated");
        }}
        onDeleted={() => {
          setEditTarget(null);
          queryClient.invalidateQueries({ queryKey: ["users"] });
          toast.success("User deleted");
        }}
      />

      <RoleSelectModal
        isOpen={roleModalUser !== null}
        user={roleModalUser}
        onClose={() => setRoleModalUser(null)}
        onRoleAssigned={(roleName) => {
          setRoleModalUser(null);
          queryClient.invalidateQueries({ queryKey: ["users"] });
          toast.success(`Role updated to ${roleName}`);
        }}
      />

      <ResetPasswordModal
        isOpen={resetPasswordTarget !== null}
        user={resetPasswordTarget}
        onClose={() => setResetPasswordTarget(null)}
        onReset={() => {
          setResetPasswordTarget(null);
          toast.success("Password reset successfully");
        }}
      />

      <ConfirmModal
        isOpen={toggleActiveTarget !== null}
        onClose={() => setToggleActiveTarget(null)}
        onConfirm={handleToggleActive}
        title={toggleActiveTarget?.is_active ? "Disable User" : "Enable User"}
        message={
          toggleActiveTarget?.is_active
            ? `Disable ${toggleActiveTarget.username}? They will no longer be able to log in.`
            : `Enable ${toggleActiveTarget?.username}? They will be able to log in again.`
        }
        confirmLabel={toggleActiveTarget?.is_active ? "Disable" : "Enable"}
        confirmVariant={toggleActiveTarget?.is_active ? "danger" : "primary"}
      />
    </PageWrapper>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────

function rowStyle(isHeader: boolean, isLast = false): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    padding: "10px 16px",
    gap: 12,
    borderBottom: isLast ? "none" : "1px solid var(--color-gray-100)",
    background: isHeader ? "var(--color-gray-50)" : "var(--color-white)",
    minHeight: 44,
    borderRadius: isHeader ? "var(--radius-lg) var(--radius-lg) 0 0" : undefined,
  };
}

function colHeader(width: string): React.CSSProperties {
  return {
    flex: width.endsWith("px") ? `0 0 ${width}` : "1 1 0",
    minWidth: 0,
    fontSize: 11,
    fontWeight: 600,
    color: "var(--color-gray-500)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    width: width.endsWith("px") ? width : undefined,
  };
}

function colCell(width: string): React.CSSProperties {
  return {
    flex: width.endsWith("px") ? `0 0 ${width}` : "1 1 0",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    width: width.endsWith("px") ? width : undefined,
  };
}
