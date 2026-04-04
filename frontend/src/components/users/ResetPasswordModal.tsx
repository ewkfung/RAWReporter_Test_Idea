import React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { updateUser } from "../../api/users";
import type { UserWithRoles } from "../../api/users";

interface ResetPasswordModalProps {
  isOpen: boolean;
  user: UserWithRoles | null;
  onClose: () => void;
  onReset: () => void;
}

export function ResetPasswordModal({ isOpen, user, onClose, onReset }: ResetPasswordModalProps) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setPassword("");
      setConfirm("");
      setError(null);
    }
  }, [isOpen]);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSave = password.trim().length >= 8 && password === confirm;

  const handleSubmit = async () => {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      await updateUser(user.id, { password });
      onReset();
    } catch {
      setError("Failed to reset password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset Password"
      width="min(90vw, 400px)"
      footer={
        <>
          {error && (
            <span style={{ fontSize: 13, color: "var(--color-danger)", marginRight: "auto" }}>
              {error}
            </span>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={!canSave}>
            Reset Password
          </Button>
        </>
      }
    >
      {user && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 13, color: "var(--color-gray-600)", margin: 0 }}>
            Resetting password for{" "}
            <strong style={{ color: "var(--color-gray-900)" }}>{user.username}</strong>
          </p>
          <Input
            label="New Password"
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="Minimum 8 characters"
          />
          <Input
            label="Confirm Password"
            required
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            hint={mismatch ? "Passwords do not match" : undefined}
          />
        </div>
      )}
    </Modal>
  );
}
