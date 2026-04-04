import React from "react";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const styles: Record<string, React.CSSProperties> = {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontWeight: 500,
    border: "1px solid transparent",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
    whiteSpace: "nowrap",
    lineHeight: 1,
  },
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--color-primary)",
    color: "var(--color-white)",
    borderColor: "var(--color-primary)",
  },
  secondary: {
    background: "var(--color-white)",
    color: "var(--color-gray-700)",
    borderColor: "var(--color-gray-300)",
  },
  danger: {
    background: "var(--color-danger)",
    color: "var(--color-white)",
    borderColor: "var(--color-danger)",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-gray-500)",
    borderColor: "transparent",
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { fontSize: 13, padding: "5px 10px", height: 30 },
  md: { fontSize: 14, padding: "7px 14px", height: 36 },
  lg: { fontSize: 15, padding: "9px 18px", height: 42 },
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  style,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: ButtonProps) {
  const [hovered, setHovered] = React.useState(false);

  const hoverOverride: React.CSSProperties =
    hovered && !disabled && !loading
      ? variant === "primary"
        ? { background: "var(--color-primary-hover)", borderColor: "var(--color-primary-hover)" }
        : variant === "secondary"
        ? { background: "var(--color-gray-50)" }
        : variant === "danger"
        ? { filter: "brightness(0.92)" }
        : { color: "var(--color-gray-700)" }
      : {};

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{
        ...styles.base,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...(disabled || loading ? { opacity: 0.55, cursor: "not-allowed" } : {}),
        ...hoverOverride,
        ...style,
      }}
      onMouseEnter={(e) => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); onMouseLeave?.(e); }}
    >
      {loading && <Spinner size={14} color={variant === "secondary" || variant === "ghost" ? "var(--color-gray-500)" : "white"} />}
      {children}
    </button>
  );
}
