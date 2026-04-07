/**
 * Shared user-picker overlay and chip used in:
 *   - EngagementFormModal (lead / consultant selection)
 *   - ReportActionsPanel (inline lead / consultant editing)
 */

import React from "react";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import type { UserWithRoles } from "../../api/users";

// ── UserPickerOverlay ──────────────────────────────────────────────────────

export function UserPickerOverlay({
  isOpen,
  title,
  excludeIds,
  users,
  isLoading,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  excludeIds: string[];
  users: UserWithRoles[];
  isLoading: boolean;
  onSelect: (user: UserWithRoles) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (isOpen) setSearch("");
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = users
    .filter((u) => !excludeIds.includes(u.id))
    .filter((u) => {
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        (u.first_name ?? "").toLowerCase().includes(q) ||
        (u.last_name ?? "").toLowerCase().includes(q)
      );
    });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-white)",
          borderRadius: "var(--radius-md)",
          padding: 20,
          width: "min(90vw, 400px)",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "70vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>{title}</h3>
        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            fontSize: 13,
            padding: "7px 10px",
            marginBottom: 10,
            border: "1px solid var(--color-gray-200)",
            borderRadius: "var(--radius-sm)",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
          }}
          autoFocus
        />
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            minHeight: 0,
            border: "1px solid var(--color-gray-200)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
              <Spinner size={18} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", fontSize: 13, color: "var(--color-gray-400)" }}>
              No users found
            </div>
          ) : (
            filtered.map((u) => {
              const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ");
              return (
                <button
                  key={u.id}
                  onClick={() => { onSelect(u); onClose(); }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid var(--color-gray-100)",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ fontWeight: 600, color: "var(--color-gray-900)" }}>{u.username}</span>
                  {fullName && (
                    <span style={{ marginLeft: 6, color: "var(--color-gray-500)" }}>{fullName}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ── UserChip ───────────────────────────────────────────────────────────────

export function UserChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove?: () => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "var(--color-gray-100)",
        border: "1px solid var(--color-gray-200)",
        fontSize: 13,
        fontWeight: 500,
        color: "var(--color-gray-800)",
      }}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            color: "var(--color-gray-400)",
            lineHeight: 1,
          }}
          title="Remove"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
