import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function Input({ label, error, hint, required, id, style, ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)" }}
        >
          {label}
          {required && <span style={{ color: "var(--color-danger)", marginLeft: 2 }}>*</span>}
        </label>
      )}
      <input
        id={inputId}
        {...rest}
        style={{
          height: 36,
          padding: "0 10px",
          fontSize: 14,
          borderRadius: "var(--radius-sm)",
          border: `1px solid ${error ? "var(--color-danger)" : "var(--color-gray-300)"}`,
          background: "var(--color-white)",
          color: "var(--color-gray-900)",
          outline: "none",
          width: "100%",
          transition: "border-color 0.15s, box-shadow 0.15s",
          ...style,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = error ? "var(--color-danger)" : "var(--color-primary)";
          e.target.style.boxShadow = `0 0 0 3px ${error ? "rgba(220,38,38,0.12)" : "rgba(37,99,235,0.12)"}`;
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? "var(--color-danger)" : "var(--color-gray-300)";
          e.target.style.boxShadow = "none";
          rest.onBlur?.(e);
        }}
      />
      {error && <span style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>{hint}</span>}
    </div>
  );
}
