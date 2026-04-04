import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/useToast";
import { useAuthStore } from "../../store/authStore";
import { login } from "../../api/auth";

export function LoginPage() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const { setToken } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(username, password);
      setToken(res.access_token);
      navigate("/");
    } catch {
      toast.error("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>
        Sign in to RAWReporter
      </h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input
          label="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <Button type="submit" variant="primary" size="lg" loading={loading} style={{ marginTop: 4 }}>
          Sign in
        </Button>
      </form>
      <p style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "var(--color-gray-500)" }}>
        No account?{" "}
        <Link to="/register" style={{ color: "var(--color-primary)", fontWeight: 500 }}>
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}
