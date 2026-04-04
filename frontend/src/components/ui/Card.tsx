import React from "react";

type Padding = "sm" | "md" | "lg";

interface CardProps {
  children: React.ReactNode;
  padding?: Padding;
  hoverable?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const paddingMap: Record<Padding, string> = {
  sm: "12px",
  md: "16px",
  lg: "24px",
};

export function Card({ children, padding = "md", hoverable, style, onClick }: CardProps) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hoverable && setHovered(true)}
      onMouseLeave={() => hoverable && setHovered(false)}
      style={{
        background: "var(--color-white)",
        borderRadius: "var(--radius-md)",
        boxShadow: hovered ? "var(--shadow-md)" : "var(--shadow-sm)",
        border: "1px solid var(--color-gray-200)",
        padding: paddingMap[padding],
        transform: hovered ? "translateY(-1px)" : "none",
        transition: "box-shadow 0.15s, transform 0.15s",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
