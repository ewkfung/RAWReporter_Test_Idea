import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-gray-50)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.02em" }}>
          RAW<span style={{ color: "var(--color-gray-900)" }}>Reporter</span>
        </span>
      </div>
      <div
        style={{
          background: "var(--color-white)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--color-gray-200)",
          padding: "32px",
          width: "100%",
          maxWidth: 400,
        }}
      >
        {children}
      </div>
    </div>
  );
}
