import React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ConfirmModal } from "../ui/ConfirmModal";
import { updateUser, deleteUser } from "../../api/users";
import { usePermission } from "../../hooks/usePermission";
import type { UserWithRoles } from "../../api/users";

interface EditUserModalProps {
  isOpen: boolean;
  user: UserWithRoles | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export function EditUserModal({ isOpen, user, onClose, onSaved, onDeleted }: EditUserModalProps) {
  const canDeactivate = usePermission("user", "deactivate");
  const canDelete = usePermission("user", "delete");

  const [username, setUsername] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const setFieldError = (field: string, msg: string) =>
    setFieldErrors((prev) => {
      if (!msg) { const n = { ...prev }; delete n[field]; return n; }
      return { ...prev, [field]: msg };
    });

  const validateEmail = (v: string) => {
    if (!v.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Please enter a valid email address";
    return "";
  };

  React.useEffect(() => {
    if (isOpen && user) {
      setUsername(user.username);
      setFirstName(user.first_name);
      setLastName(user.last_name);
      setEmail(user.email);
      setError(null);
      setFieldErrors({});
    }
  }, [isOpen, user]);

  const canSave = username.trim() && email.trim();

  const validateAll = () => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = "Username is required";
    const emailErr = validateEmail(email);
    if (emailErr) errs.email = emailErr;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!user || !validateAll()) return;
    setError(null);
    setSaving(true);
    try {
      await updateUser(user.id, {
        username: username.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
      });
      onSaved();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      onSaved();
    } catch {
      setError("Failed to update user status.");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await deleteUser(user.id);
      setDeleteConfirmOpen(false);
      onDeleted();
    } catch {
      setDeleteConfirmOpen(false);
      setError("Failed to delete user.");
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !deleteConfirmOpen}
        onClose={onClose}
        title="Edit User"
        width="min(90vw, 460px)"
        footer={
          <>
            {error && (
              <span style={{ fontSize: 13, color: "var(--color-danger)", marginRight: "auto" }}>
                {error}
              </span>
            )}
            <Button variant="secondary" onClick={onClose} disabled={saving || deleting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={!canSave || deleting}>
              Save Changes
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input
            label="Username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => setFieldError("username", username.trim() ? "" : "Username is required")}
            error={fieldErrors.username}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <Input
            label="Email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setFieldError("email", validateEmail(email))}
            error={fieldErrors.email}
          />

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--color-gray-200)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Activate / Deactivate */}
            {canDeactivate && user && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)", margin: 0 }}>
                    Account Status
                  </p>
                  <p style={{ fontSize: 12, color: "var(--color-gray-500)", margin: "2px 0 0" }}>
                    {user.is_active ? "User can currently log in." : "User cannot log in."}
                  </p>
                </div>
                <button
                  onClick={handleToggleActive}
                  disabled={saving || deleting}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: user.is_active ? "var(--color-warning, #d97706)" : "var(--color-success, #16a34a)",
                    background: "none",
                    border: `1px solid ${user.is_active ? "var(--color-warning, #d97706)" : "var(--color-success, #16a34a)"}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "4px 10px",
                    cursor: "pointer",
                    opacity: saving || deleting ? 0.5 : 1,
                  }}
                >
                  {user.is_active ? "Deactivate User" : "Activate User"}
                </button>
              </div>
            )}

            {/* Delete */}
            {canDelete && user && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)", margin: 0 }}>
                    Delete User
                  </p>
                  <p style={{ fontSize: 12, color: "var(--color-gray-500)", margin: "2px 0 0" }}>
                    Permanently removes the user and all their data.
                  </p>
                </div>
                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={saving || deleting}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--color-danger)",
                    background: "none",
                    border: "1px solid var(--color-danger)",
                    borderRadius: "var(--radius-sm)",
                    padding: "4px 10px",
                    cursor: "pointer",
                    opacity: saving || deleting ? 0.5 : 1,
                  }}
                >
                  Delete User
                </button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Permanently delete "${user?.username}"? This cannot be undone and will remove all their data.`}
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
      />
    </>
  );
}
