import React from "react";
import type { LibraryFinding } from "../../types/models";
import { SeverityBadge, Badge } from "../ui/Badge";
import { ConfirmModal } from "../ui/ConfirmModal";
import { usePermission } from "../../hooks/usePermission";

interface LibraryFindingRowProps {
  finding: LibraryFinding;
  onEdit: (finding: LibraryFinding) => void;
  onArchive: (finding: LibraryFinding) => void;
  onDelete: (finding: LibraryFinding) => void;
}

export function LibraryFindingRow({
  finding,
  onEdit,
  onArchive,
  onDelete,
}: LibraryFindingRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const canManage = usePermission("library_finding", "edit");

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const enabledRefs = (
    [
      finding.ref_cve_enabled && "CVE",
      finding.ref_cwe_enabled && "CWE",
      finding.ref_cisa_enabled && "CISA",
      finding.ref_nist_enabled && "NIST",
      finding.ref_nvd_enabled && "NVD",
      finding.ref_manufacturer_enabled && "Manufacturer",
    ] as Array<string | false>
  ).filter(Boolean) as string[];

  return (
    <>
      <div
        style={{
          background: "var(--color-white)",
          border: "1px solid var(--color-gray-200)",
          borderRadius: "var(--radius-md)",
          marginBottom: 6,
        }}
      >
        {/* Row header — always visible */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setExpanded((v) => !v)}
        >
          {/* Chevron */}
          <span
            style={{
              flexShrink: 0,
              color: "var(--color-gray-400)",
              transition: "transform 0.15s",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              display: "inline-flex",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>

          <SeverityBadge severity={finding.severity} />

          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--color-gray-900)" }}>
            {finding.title}
          </span>

          {finding.vertical && (
            <Badge variant="neutral" style={{ fontSize: 11 }}>
              {finding.vertical}
            </Badge>
          )}

          {/* Manage dropdown — stop propagation so row doesn't toggle */}
          {canManage && (
            <div
              ref={menuRef}
              style={{ position: "relative", flexShrink: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setMenuOpen((v) => !v)}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--color-gray-600)",
                  background: "var(--color-gray-50)",
                  border: "1px solid var(--color-gray-200)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Manage
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 4px)",
                    background: "var(--color-white)",
                    border: "1px solid var(--color-gray-200)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-md)",
                    zIndex: 200,
                    minWidth: 140,
                    overflow: "hidden",
                  }}
                >
                  {[
                    { label: "Edit", action: () => { setMenuOpen(false); onEdit(finding); } },
                    { label: "Archive", action: () => { setMenuOpen(false); setArchiveOpen(true); }, color: "var(--color-warning)" },
                    { label: "Delete", action: () => { setMenuOpen(false); setDeleteOpen(true); }, color: "var(--color-danger)" },
                  ].map(({ label, action, color }) => (
                    <button
                      key={label}
                      onClick={action}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "8px 14px",
                        fontSize: 13,
                        fontWeight: 500,
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: color ?? "var(--color-gray-700)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div
            style={{
              borderTop: "1px solid var(--color-gray-100)",
              padding: "14px 38px 16px",
              background: "var(--color-gray-50)",
            }}
          >
            {finding.summary && (
              <p style={{ fontSize: 13, color: "var(--color-gray-700)", lineHeight: 1.65, marginBottom: 12 }}>
                {finding.summary}
              </p>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {finding.framework_refs.map((ref) => (
                <Badge key={ref} variant="neutral" style={{ fontSize: 11 }}>{ref}</Badge>
              ))}
              {finding.is_ot_specific && (
                <Badge variant="blue" style={{ fontSize: 11 }}>OT Specific</Badge>
              )}
            </div>

            {enabledRefs.length > 0 && (
              <p style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
                References: {enabledRefs.join(" · ")}
              </p>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => onArchive(finding)}
        title="Archive Finding"
        message={`Archive "${finding.title}"? It will be hidden from the library but can be restored later.`}
        confirmLabel="Archive"
        confirmVariant="secondary"
      />

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => onDelete(finding)}
        title="Delete Finding"
        message={`Permanently delete "${finding.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </>
  );
}
