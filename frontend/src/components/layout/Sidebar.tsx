import React from "react";
import { NavLink } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { usePermission } from "../../hooks/usePermission";
import { LayoutContext } from "./LayoutContext";

// ── Constants ──────────────────────────────────────────────────────────────

export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 56;

// ── Icons ──────────────────────────────────────────────────────────────────

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ClientsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EngagementsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8h6M5 5.5h6M5 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 2h2v12H3zM7 2h2v12H7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 2l2.5 11.5-2 .5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 14c0-2.761 2.239-4.5 5-4.5s5 1.739 5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 7.5c1.105 0 2 .895 2 2M13 7.5a3 3 0 0 1 2 2.83V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TemplatesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="11" r="2.5" fill="var(--color-white)" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11.3 11h1.4M12 10.3v1.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function AuditLogIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="1" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 5h4M5 7.5h4M5 10h2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12.5" cy="12.5" r="2.5" fill="var(--color-white)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11.5 12.5h2M12.5 11.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ── Nav items ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: "/",            label: "Dashboard",   icon: <DashboardIcon /> },
  { path: "/clients",     label: "Clients",     icon: <ClientsIcon /> },
  { path: "/engagements", label: "Engagements", icon: <EngagementsIcon /> },
  { path: "/reports",     label: "Reports",     icon: <ReportsIcon /> },
  { path: "/library",     label: "Library",     icon: <LibraryIcon /> },
];

// ── Component ──────────────────────────────────────────────────────────────

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const canViewUsers = usePermission("user", "view");
  const canViewAuditLog = usePermission("audit_log", "view");
  const canEditTemplates = usePermission("report_default_template", "edit");
  const canUploadDocTemplates = usePermission("document_template", "upload");
  const { sidebarCollapsed, toggleSidebar } = React.useContext(LayoutContext);

  const w = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  const initials = user
    ? ((user.first_name?.[0] ?? "") + (user.last_name?.[0] ?? "")).toUpperCase() ||
      user.username.slice(0, 2).toUpperCase()
    : "?";

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: w,
        height: "100vh",
        background: "var(--color-white)",
        borderRight: "1px solid var(--color-gray-200)",
        display: "flex",
        flexDirection: "column",
        zIndex: 100,
        transition: "width 0.2s ease",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: "var(--topbar-height)",
          display: "flex",
          alignItems: "center",
          justifyContent: sidebarCollapsed ? "center" : "space-between",
          padding: sidebarCollapsed ? "0" : "0 12px 0 20px",
          borderBottom: "1px solid var(--color-gray-200)",
          flexShrink: 0,
        }}
      >
        {!sidebarCollapsed && (
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            RAW<span style={{ color: "var(--color-gray-900)" }}>Reporter</span>
          </span>
        )}
        {sidebarCollapsed && (
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.02em" }}>
            RR
          </span>
        )}
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            title="Collapse sidebar"
            style={toggleBtnStyle}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: sidebarCollapsed ? "12px 4px" : "12px 8px", overflowY: "auto", overflowX: "hidden" }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            title={sidebarCollapsed ? item.label : undefined}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: 10,
              padding: sidebarCollapsed ? "9px 0" : "8px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--color-primary)" : "var(--color-gray-500)",
              background: isActive ? "var(--color-primary-light)" : "transparent",
              borderLeft: (!sidebarCollapsed && isActive) ? "2px solid var(--color-primary)" : "2px solid transparent",
              marginBottom: 2,
              transition: "background 0.1s, color 0.1s",
              textDecoration: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
            })}
          >
            {item.icon}
            {!sidebarCollapsed && item.label}
          </NavLink>
        ))}

        {(canViewUsers || canViewAuditLog || canEditTemplates || canUploadDocTemplates) && (
          <div style={{ marginTop: 16 }}>
            {!sidebarCollapsed && (
              <p style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--color-gray-400)",
                padding: "0 12px",
                marginBottom: 4,
                whiteSpace: "nowrap",
              }}>
                Settings
              </p>
            )}
            {canViewUsers && (
              <NavLink
                to="/settings/users"
                title={sidebarCollapsed ? "Users" : undefined}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  gap: 10,
                  padding: sidebarCollapsed ? "9px 0" : "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--color-primary)" : "var(--color-gray-500)",
                  background: isActive ? "var(--color-primary-light)" : "transparent",
                  borderLeft: (!sidebarCollapsed && isActive) ? "2px solid var(--color-primary)" : "2px solid transparent",
                  marginBottom: 2,
                  transition: "background 0.1s, color 0.1s",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                })}
              >
                <UsersIcon />
                {!sidebarCollapsed && "Users"}
              </NavLink>
            )}
            {canViewAuditLog && (
              <NavLink
                to="/settings/audit-log"
                title={sidebarCollapsed ? "Logs" : undefined}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  gap: 10,
                  padding: sidebarCollapsed ? "9px 0" : "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--color-primary)" : "var(--color-gray-500)",
                  background: isActive ? "var(--color-primary-light)" : "transparent",
                  borderLeft: (!sidebarCollapsed && isActive) ? "2px solid var(--color-primary)" : "2px solid transparent",
                  marginBottom: 2,
                  transition: "background 0.1s, color 0.1s",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                })}
              >
                <AuditLogIcon />
                {!sidebarCollapsed && "Logs"}
              </NavLink>
            )}
            {canEditTemplates && (
              <NavLink
                to="/settings/templates"
                title={sidebarCollapsed ? "Templates" : undefined}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  gap: 10,
                  padding: sidebarCollapsed ? "9px 0" : "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--color-primary)" : "var(--color-gray-500)",
                  background: isActive ? "var(--color-primary-light)" : "transparent",
                  borderLeft: (!sidebarCollapsed && isActive) ? "2px solid var(--color-primary)" : "2px solid transparent",
                  marginBottom: 2,
                  transition: "background 0.1s, color 0.1s",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                })}
              >
                <TemplatesIcon />
                {!sidebarCollapsed && "Templates"}
              </NavLink>
            )}
            {canUploadDocTemplates && (
              <NavLink
                to="/settings/document-templates"
                title={sidebarCollapsed ? "Doc Templates" : undefined}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  gap: 10,
                  padding: sidebarCollapsed ? "9px 0" : "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--color-primary)" : "var(--color-gray-500)",
                  background: isActive ? "var(--color-primary-light)" : "transparent",
                  borderLeft: (!sidebarCollapsed && isActive) ? "2px solid var(--color-primary)" : "2px solid transparent",
                  marginBottom: 2,
                  transition: "background 0.1s, color 0.1s",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                })}
              >
                <ReportsIcon />
                {!sidebarCollapsed && "Doc Templates"}
              </NavLink>
            )}
          </div>
        )}

        {/* Expand button when collapsed */}
        {sidebarCollapsed && (
          <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
            <button
              onClick={toggleSidebar}
              title="Expand sidebar"
              style={toggleBtnStyle}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </nav>

      {/* User */}
      <div
        style={{
          borderTop: "1px solid var(--color-gray-200)",
          padding: sidebarCollapsed ? "12px 0" : "12px 16px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: sidebarCollapsed ? "center" : "stretch",
          gap: 8,
        }}
      >
        {/* Avatar */}
        <div
          title={sidebarCollapsed ? (user ? `${user.first_name} ${user.last_name}`.trim() || user.username : "") : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflow: "hidden",
          }}
        >
          <div style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--color-primary-light)",
            color: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {initials}
          </div>
          {!sidebarCollapsed && (
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                {user ? `${user.first_name} ${user.last_name}`.trim() || user.username : "—"}
              </p>
              <p style={{ fontSize: 11, color: "var(--color-gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                @{user?.username ?? ""}
              </p>
            </div>
          )}
        </div>

        {!sidebarCollapsed && (
          <button
            onClick={logout}
            style={{
              width: "100%",
              padding: "6px 10px",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-gray-500)",
              background: "none",
              border: "1px solid var(--color-gray-200)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            Sign out
          </button>
        )}

        {sidebarCollapsed && (
          <button
            onClick={logout}
            title="Sign out"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-gray-400)",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M6 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M10 10l3-2.5L10 5M13 7.5H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}

const toggleBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--color-gray-200)",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  padding: "4px 6px",
  color: "var(--color-gray-400)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
