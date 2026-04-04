import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { createUser, listRoles } from "../../api/users";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (roleName: string) => void;
}

export function CreateUserModal({ isOpen, onClose, onCreated }: CreateUserModalProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [roleId, setRoleId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: listRoles,
    enabled: isOpen,
  });

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.display_name }));

  // Pre-select first role when list loads
  React.useEffect(() => {
    if (roles.length > 0 && !roleId) setRoleId(roles[0].id);
  }, [roles, roleId]);

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

  const reset = () => {
    setEmail("");
    setPassword("");
    setUsername("");
    setFirstName("");
    setLastName("");
    setRoleId(roles[0]?.id ?? "");
    setError(null);
    setFieldErrors({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canSave = email.trim() && password.trim() && username.trim() && roleId;

  const validateAll = () => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = "Username is required";
    const emailErr = validateEmail(email);
    if (emailErr) errs.email = emailErr;
    if (!password.trim()) errs.password = "Password is required";
    else if (password.trim().length < 8) errs.password = "Must be at least 8 characters";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateAll()) return;
    setError(null);
    setSaving(true);
    try {
      await createUser({
        email: email.trim(),
        password,
        username: username.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role_id: roleId,
      });
      const roleName = roles.find((r) => r.id === roleId)?.display_name ?? "assigned";
      reset();
      onCreated(roleName);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to create user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create User"
      width="min(90vw, 480px)"
      footer={
        <>
          {error && (
            <span style={{ fontSize: 13, color: "var(--color-danger)", marginRight: "auto" }}>
              {error}
            </span>
          )}
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={!canSave}>
            Create User
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
        <Input
          label="Password"
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setFieldError("password", !password.trim() ? "Password is required" : password.trim().length < 8 ? "Must be at least 8 characters" : "")}
          error={fieldErrors.password}
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
        <Select
          label="Role"
          required
          options={roleOptions}
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
        />
      </div>
    </Modal>
  );
}
