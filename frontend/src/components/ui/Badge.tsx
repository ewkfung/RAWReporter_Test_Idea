import React from "react";

export type BadgeVariant =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational"
  | "neutral"
  | "success"
  | "warning"
  | "blue";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const variantMap: Record<BadgeVariant, { bg: string; color: string }> = {
  critical:      { bg: "rgba(124,58,237,0.12)", color: "var(--severity-critical)" },
  high:          { bg: "rgba(220,38,38,0.12)",  color: "var(--severity-high)" },
  medium:        { bg: "rgba(217,119,6,0.12)",  color: "var(--severity-medium)" },
  low:           { bg: "rgba(37,99,235,0.12)",  color: "var(--severity-low)" },
  informational: { bg: "rgba(107,114,128,0.12)", color: "var(--severity-info)" },
  neutral:       { bg: "var(--color-gray-100)", color: "var(--color-gray-500)" },
  success:       { bg: "rgba(22,163,74,0.12)",  color: "var(--color-success)" },
  warning:       { bg: "rgba(217,119,6,0.12)",  color: "var(--color-warning)" },
  blue:          { bg: "rgba(37,99,235,0.12)",  color: "var(--color-primary)" },
};

export function Badge({ variant = "neutral", children, style }: BadgeProps) {
  const { bg, color } = variantMap[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.6,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        background: bg,
        color,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Convenience: derive badge variant from severity string */
export function SeverityBadge({ severity }: { severity: string }) {
  const variant = (["critical", "high", "medium", "low", "informational"].includes(severity)
    ? severity
    : "neutral") as BadgeVariant;
  return <Badge variant={variant}>{severity}</Badge>;
}
