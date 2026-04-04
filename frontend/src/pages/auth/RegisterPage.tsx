import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/useToast";
import { useAuthStore } from "../../store/authStore";
import { register, login } from "../../api/auth";

export function RegisterPage() {
  const [form, setForm] = React.useState({
    username: "",
    password: "",
    confirm: "",
    first_name: "",
    last_name: "",
    email: "",
  });
  const [errors, setErrors] = React.useState<Partial<typeof form>>({});
  const [loading, setLoading] = React.useState(false);
  const { setToken } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast();

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setErrors((err) => ({ ...err, [field]: undefined }));
    };

  const validate = () => {
    const errs: Partial<typeof form> = {};
    if (!form.username.trim()) errs.username = "Username is required.";
    if (form.password.length < 8) errs.password = "Password must be at least 8 characters.";
    if (form.password !== form.confirm) errs.confirm = "Passwords do not match.";
    if (!form.first_name.trim()) errs.first_name = "First name is required.";
    if (!form.last_name.trim()) errs.last_name = "Last name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      await register({
        username: form.username.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
      });
      const res = await login(form.username.trim(), form.password);
      setToken(res.access_token);
      navigate("/");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      if (typeof detail === "string") toast.error(detail);
      else if (Array.isArray(detail)) toast.error(detail.map((d: { msg?: string }) => d.msg).join(", "));
      else toast.error("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>
        Create your account
      </h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input
          label="Username"
          type="text"
          value={form.username}
          onChange={set("username")}
          required
          error={errors.username}
          autoComplete="username"
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input
            label="First Name"
            type="text"
            value={form.first_name}
            onChange={set("first_name")}
            required
            error={errors.first_name}
            autoComplete="given-name"
          />
          <Input
            label="Last Name"
            type="text"
            value={form.last_name}
            onChange={set("last_name")}
            required
            error={errors.last_name}
            autoComplete="family-name"
          />
        </div>
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={set("email")}
          required
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={set("password")}
          required
          error={errors.password}
          hint="Minimum 8 characters"
          autoComplete="new-password"
        />
        <Input
          label="Confirm Password"
          type="password"
          value={form.confirm}
          onChange={set("confirm")}
          required
          error={errors.confirm}
          autoComplete="new-password"
        />
        <Button type="submit" variant="primary" size="lg" loading={loading} style={{ marginTop: 4 }}>
          Create account
        </Button>
      </form>
      <p style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "var(--color-gray-500)" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "var(--color-primary)", fontWeight: 500 }}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
