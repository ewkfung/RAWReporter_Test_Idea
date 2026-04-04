import React from "react";
import { Link } from "react-router-dom";
import { LayoutContext } from "./LayoutContext";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "./Sidebar";

export interface Breadcrumb {
  label: string;
  to?: string;
}

interface TopbarProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
}

export function Topbar({ title, breadcrumbs }: TopbarProps) {
  const { sidebarCollapsed } = React.useContext(LayoutContext);
  const sidebarW = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: sidebarW,
        right: 0,
        height: "var(--topbar-height)",
        background: "var(--color-white)",
        borderBottom: "1px solid var(--color-gray-200)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        zIndex: 90,
        gap: 8,
        transition: "left 0.2s ease",
      }}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--color-gray-300)", flexShrink: 0 }}>
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {crumb.to ? (
                <Link
                  to={crumb.to}
                  style={{ color: "var(--color-gray-500)", fontWeight: 400, transition: "color 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-gray-900)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-gray-500)")}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span style={{ color: "var(--color-gray-900)", fontWeight: 600 }}>{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      ) : (
        <h1 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-gray-900)" }}>{title}</h1>
      )}
    </header>
  );
}
