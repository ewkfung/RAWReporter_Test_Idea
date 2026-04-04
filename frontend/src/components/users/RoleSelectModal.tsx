import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { assignRole, listRoles } from "../../api/users";
import type { UserWithRoles } from "../../api/users";

interface RoleSelectModalProps {
  isOpen: boolean;
  user: UserWithRoles | null;
  onClose: () => void;
  onRoleAssigned: (roleDisplayName: string) => void;
}

export function RoleSelectModal({ isOpen, user, onClose, onRoleAssigned }: RoleSelectModalProps) {
  const [roleId, setRoleId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: listRoles,
    enabled: isOpen,
  });

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.display_name }));

  // Pre-select user's current role when modal opens
  React.useEffect(() => {
    if (isOpen && user && roles.length > 0) {
      const currentRoleId = roles.find((r) => r.name === user.roles[0]?.name)?.id;
      setRoleId(currentRoleId ?? roles[0]?.id ?? "");
      setError(null);
    }
  }, [isOpen, user, roles]);

  const handleSubmit = async () => {
    if (!user || !roleId) return;
    setError(null);
    setSaving(true);
    try {
      await assignRole(user.id, roleId);
      const roleName = roles.find((r) => r.id === roleId)?.display_name ?? "assigned";
      onRoleAssigned(roleName);
    } catch {
      setError("Failed to assign role. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Role"
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
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={!roleId}>
            Confirm
          </Button>
        </>
      }
    >
      {user && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 13, color: "var(--color-gray-600)", margin: 0 }}>
            Changing role for <strong style={{ color: "var(--color-gray-900)" }}>{user.email}</strong>
          </p>
          <Select
            label="Role"
            options={roleOptions}
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          />
        </div>
      )}
    </Modal>
  );
}
