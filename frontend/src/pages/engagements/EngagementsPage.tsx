import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { SkeletonTable } from "../../components/loading/SkeletonTable";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { EngagementFormModal } from "../../components/engagements/EngagementFormModal";
import { StatusChangeModal } from "../../components/engagements/StatusChangeModal";
import { ReportFormModal } from "../../components/reports/ReportFormModal";
import { usePermission } from "../../hooks/usePermission";
import { useToast } from "../../components/ui/useToast";
import {
  getEngagements,
  deleteEngagement,
  archiveEngagement,
} from "../../api/engagements";
import { getClients } from "../../api/clients";
import { listUsers } from "../../api/users";
import {
  getReports,
  linkReport,
  unlinkReport,
} from "../../api/reports";
import { formatRelativeTime, formatDate } from "../../utils/formatting";
import type { Engagement, EngagementStatus, EngagementType } from "../../types/models";
import type { BadgeVariant } from "../../components/ui/Badge";

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_BADGE: Record<EngagementStatus, BadgeVariant> = {
  scoping: "neutral",
  active: "success",
  in_review: "warning",
  delivered: "blue",
  completed: "success",
  closed: "neutral",
};

const STATUS_LABEL: Record<EngagementStatus, string> = {
  scoping: "Scoping",
  active: "Active",
  in_review: "In Review",
  delivered: "Delivered",
  completed: "Completed",
  closed: "Closed",
};

const STATUS_BORDER: Record<EngagementStatus, string> = {
  scoping: "var(--color-gray-300)",
  active: "var(--color-success, #16a34a)",
  in_review: "var(--color-warning, #d97706)",
  delivered: "var(--color-primary)",
  completed: "#059669",
  closed: "var(--color-gray-200)",
};

// ── Type config ────────────────────────────────────────────────────────────

export const TYPE_LABEL: Record<EngagementType, string> = {
  pentest: "Pentest",
  gap_assessment: "Gap Assessment",
  vulnerability_assessment: "Vuln Assessment",
  tabletop: "Tabletop",         // legacy — display only
  tsa_directive: "TSA Directive", // legacy — display only
  compliance_assessment: "Compliance",
  risk: "Risk Assessment",
};

const TYPE_COLOR: Record<EngagementType, { bg: string; color: string }> = {
  pentest: { bg: "#fee2e2", color: "#dc2626" },
  gap_assessment: { bg: "#ede9fe", color: "#7c3aed" },
  vulnerability_assessment: { bg: "#ffedd5", color: "#d97706" },
  tabletop: { bg: "#ccfbf1", color: "#0d9488" },
  tsa_directive: { bg: "#dbeafe", color: "#2563eb" },
  compliance_assessment: { bg: "#f3f4f6", color: "#6b7280" },
  risk: { bg: "#d1fae5", color: "#065f46" },
};

// ── Type pills ─────────────────────────────────────────────────────────────

export function TypePills({ types }: { types: EngagementType[] }) {
  if (!types || types.length === 0) {
    return <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>—</span>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {types.map((t) => {
        const c = TYPE_COLOR[t] ?? { bg: "#f3f4f6", color: "#6b7280" };
        return (
          <span
            key={t}
            style={{
              fontSize: 11,
              fontWeight: 600,
              background: c.bg,
              color: c.color,
              padding: "2px 8px",
              borderRadius: 999,
              whiteSpace: "nowrap",
            }}
          >
            {TYPE_LABEL[t] ?? t}
          </span>
        );
      })}
    </div>
  );
}

// ── Manage dropdown ────────────────────────────────────────────────────────

function ManageDropdown({
  onEdit,
  onChangeStatus,
  onUnlinkReport,
  onArchive,
  onDelete,
  canArchive,
  canDelete,
  canEdit,
}: {
  onEdit: () => void;
  onChangeStatus: () => void;
  onUnlinkReport: () => void;
  onArchive: () => void;
  onDelete: () => void;
  canArchive: boolean;
  canDelete: boolean;
  canEdit: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
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
      {open && (
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
            minWidth: 160,
            overflow: "hidden",
          }}
        >
          {canEdit && <button onClick={() => { setOpen(false); onEdit(); }} style={menuItemStyle()} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>Edit</button>}
          {canEdit && <button onClick={() => { setOpen(false); onChangeStatus(); }} style={menuItemStyle()} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>Change Status</button>}
          {canEdit && <button onClick={() => { setOpen(false); onUnlinkReport(); }} style={menuItemStyle()} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>Unlink Report</button>}
          {canArchive && (
            <button onClick={() => { setOpen(false); onArchive(); }} style={menuItemStyle("var(--color-warning, #d97706)")} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>Archive</button>
          )}
          {canDelete && (
            <button onClick={() => { setOpen(false); onDelete(); }} style={menuItemStyle("var(--color-danger)")} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>Delete</button>
          )}
        </div>
      )}
    </div>
  );
}

function menuItemStyle(color = "var(--color-gray-700)"): React.CSSProperties {
  return {
    display: "block", width: "100%", padding: "8px 14px",
    fontSize: 13, fontWeight: 500, textAlign: "left",
    background: "none", border: "none", cursor: "pointer", color,
  };
}

// ── Add Report Modal ───────────────────────────────────────────────────────
// Shows all reports that currently have no engagement (engagement_id is null).
// The user can select one or more and link them to this engagement in bulk.
// Query is always fresh (staleTime: 0) so the list reflects the current state.

function AddReportModal({
  isOpen,
  engagementId,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  engagementId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);

  const { data: allReports = [], isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => getReports(),
    enabled: isOpen,
    staleTime: 0,
  });

  // Show all reports not already linked to this engagement
  const available = React.useMemo(
    () => allReports.filter((r) => r.engagement_id !== engagementId),
    [allReports, engagementId]
  );

  const REPORT_STATUS_LABEL: Record<string, string> = {
    draft: "Draft", review: "Review", editing: "Editing",
    final_review: "Final Review", complete: "Complete",
  };

  React.useEffect(() => {
    if (isOpen) setSelected(new Set());
  }, [isOpen]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await Promise.all([...selected].map((id) => linkReport(id, engagementId)));
      queryClient.invalidateQueries({ queryKey: ["reports", "by-engagement", engagementId] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success(`${selected.size} report${selected.size > 1 ? "s" : ""} added to engagement`);
      onSuccess();
    } catch {
      toast.error("Failed to add reports");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-md)", padding: 24, width: "min(90vw, 520px)", boxShadow: "var(--shadow-xl)", maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Add Report to Engagement</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--color-gray-500)" }}>
          Select one or more unlinked reports to add to this engagement.
        </p>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)" }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Spinner size={20} /></div>
          ) : available.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--color-gray-400)" }}>
              No reports available to add.
            </div>
          ) : (
            available.map((r) => (
              <label
                key={r.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", cursor: "pointer",
                  borderBottom: "1px solid var(--color-gray-100)",
                  background: selected.has(r.id) ? "var(--color-gray-50)" : "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  style={{ flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-gray-400)", marginTop: 2 }}>
                    {REPORT_STATUS_LABEL[r.status] ?? r.status}
                    {r.end_date && ` · End ${new Date(r.end_date).toLocaleDateString()}`}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd} loading={saving} disabled={selected.size === 0}>
            Add {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Unlink Report Modal ────────────────────────────────────────────────────
// Shows all reports currently linked to this engagement.
// The user can select one or more to unlink (sets engagement_id to null).
// Reports are not deleted — they become unlinked and appear in the Add Report picker.

function UnlinkReportModal({
  isOpen,
  engagementId,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  engagementId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);

  const { data: linkedReports = [], isLoading } = useQuery({
    queryKey: ["reports", "by-engagement", engagementId],
    queryFn: () => getReports(engagementId),
    enabled: isOpen,
    staleTime: 0,
  });

  const REPORT_STATUS_LABEL: Record<string, string> = {
    draft: "Draft", review: "Review", editing: "Editing",
    final_review: "Final Review", complete: "Complete",
  };

  React.useEffect(() => {
    if (isOpen) setSelected(new Set());
  }, [isOpen]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleUnlink = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await Promise.all([...selected].map((id) => unlinkReport(id)));
      queryClient.invalidateQueries({ queryKey: ["reports", "by-engagement", engagementId] });
      queryClient.invalidateQueries({ queryKey: ["reports-unlinked"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success(`${selected.size} report${selected.size > 1 ? "s" : ""} unlinked`);
      onSuccess();
    } catch {
      toast.error("Failed to unlink reports");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-md)", padding: 24, width: "min(90vw, 520px)", boxShadow: "var(--shadow-xl)", maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Unlink Reports</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--color-gray-500)" }}>
          Select reports to remove from this engagement. They will become unlinked and can be re-added later.
        </p>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)" }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Spinner size={20} /></div>
          ) : linkedReports.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--color-gray-400)" }}>
              No reports linked to this engagement.
            </div>
          ) : (
            linkedReports.map((r) => (
              <label
                key={r.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", cursor: "pointer",
                  borderBottom: "1px solid var(--color-gray-100)",
                  background: selected.has(r.id) ? "#fff7ed" : "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  style={{ flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-gray-400)", marginTop: 2 }}>
                    {REPORT_STATUS_LABEL[r.status] ?? r.status}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="danger" onClick={handleUnlink} loading={saving} disabled={selected.size === 0}>
            Unlink {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Engagement reports (lazy) ──────────────────────────────────────────────
// Reports for an engagement are fetched only when the row is first expanded,
// keeping the initial page load fast. Two creation paths are offered:
//   "+ New Report" — creates a fresh report linked to this engagement
//   "+ Add Report" — opens AddReportModal to link an existing unlinked report

function EngagementReports({
  engagementId,
  canCreate,
  canEdit,
}: {
  engagementId: string;
  canCreate: boolean;
  canEdit: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newReportOpen, setNewReportOpen] = React.useState(false);
  const [addReportOpen, setAddReportOpen] = React.useState(false);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", "by-engagement", engagementId],
    queryFn: () => getReports(engagementId),
    staleTime: 120_000,
  });

  const REPORT_STATUS_BADGE: Record<string, BadgeVariant> = {
    draft: "neutral", review: "warning", editing: "blue",
    final_review: "warning", complete: "success",
  };
  const REPORT_STATUS_LABEL: Record<string, string> = {
    draft: "Draft", review: "Review", editing: "Editing",
    final_review: "Final Review", complete: "Complete",
  };

  if (isLoading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}><Spinner size={20} /></div>;
  }

  return (
    <div>
      {reports.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {reports.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", background: "var(--color-white)",
                border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)", flexWrap: "wrap",
              }}
            >
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)", minWidth: 0 }}>{r.title}</span>
              <Badge variant={REPORT_STATUS_BADGE[r.status] ?? "neutral"}>
                {REPORT_STATUS_LABEL[r.status] ?? r.status}
              </Badge>
              <span style={{ fontSize: 11, color: "var(--color-gray-400)" }}>{formatRelativeTime(r.updated_at)}</span>
              <button
                onClick={() => navigate(`/reports/${r.id}/build`)}
                style={{ fontSize: 12, fontWeight: 500, color: "var(--color-primary)", background: "none", border: "1px solid var(--color-primary)", borderRadius: "var(--radius-sm)", padding: "2px 8px", cursor: "pointer" }}
              >
                Open Builder
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--color-gray-400)", marginBottom: 10 }}>
          No reports for this engagement yet.
        </p>
      )}

      {/* Action buttons */}
      {(canCreate || canEdit) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canCreate && (
            <button
              onClick={() => setNewReportOpen(true)}
              style={{ fontSize: 12, fontWeight: 500, color: "var(--color-primary)", background: "none", border: "1px dashed var(--color-primary)", borderRadius: "var(--radius-sm)", padding: "5px 12px", cursor: "pointer" }}
            >
              + New Report
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setAddReportOpen(true)}
              style={{ fontSize: 12, fontWeight: 500, color: "var(--color-gray-600)", background: "none", border: "1px dashed var(--color-gray-400)", borderRadius: "var(--radius-sm)", padding: "5px 12px", cursor: "pointer" }}
            >
              + Add Report
            </button>
          )}
        </div>
      )}

      <ReportFormModal
        isOpen={newReportOpen}
        onClose={() => setNewReportOpen(false)}
        engagementId={engagementId}
        onSuccess={() => {
          setNewReportOpen(false);
          queryClient.invalidateQueries({ queryKey: ["reports", "by-engagement", engagementId] });
          queryClient.invalidateQueries({ queryKey: ["reports"] });
        }}
      />

      <AddReportModal
        isOpen={addReportOpen}
        engagementId={engagementId}
        onClose={() => setAddReportOpen(false)}
        onSuccess={() => setAddReportOpen(false)}
      />
    </div>
  );
}

// ── Engagement row ─────────────────────────────────────────────────────────

function EngagementRow({
  engagement,
  clientName,
  isExpanded,
  onToggle,
  onEdit,
  onChangeStatus,
  onArchive,
  onDelete,
  canEdit,
  canArchive,
  canDelete,
  canCreateReport,
  userMap,
}: {
  engagement: Engagement;
  clientName: string;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onChangeStatus: () => void;
  onArchive: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canCreateReport: boolean;
  userMap: Map<string, { username: string; first_name?: string | null; last_name?: string | null }>;
}) {
  const navigate = useNavigate();
  const [unlinkOpen, setUnlinkOpen] = React.useState(false);
  const borderColor = STATUS_BORDER[engagement.status] ?? "var(--color-gray-200)";

  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: "var(--color-gray-500)",
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10,
  };
  const infoLabel: React.CSSProperties = {
    fontSize: 11, color: "var(--color-gray-400)", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.04em",
  };
  const infoValue: React.CSSProperties = {
    fontSize: 13, color: "var(--color-gray-700)", marginTop: 2,
  };

  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-200)",
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: "var(--radius-md)",
        marginBottom: 8,
      }}
    >
      {/* Collapsed row — 5-column layout: name | customer | type | status | last updated + manage */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "24px 1fr 160px 1fr auto auto auto",
          alignItems: "center",
          gap: 16,
          padding: "14px 16px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={onToggle}
      >
        {/* Chevron */}
        <span
          style={{
            color: "var(--color-gray-400)", transition: "transform 0.15s",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            display: "inline-flex", justifyContent: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>

        {/* 1. Engagement Name */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {engagement.title}
          </div>
        </div>

        {/* 2. Customer */}
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/clients?expand=${engagement.client_id}`); }}
          style={{
            fontSize: 13, color: "var(--color-gray-500)", background: "none", border: "none",
            cursor: "pointer", padding: 0, textAlign: "left",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
          title={clientName}
        >
          {clientName || "—"}
        </button>

        {/* 3. Type pills */}
        <div onClick={(e) => e.stopPropagation()}>
          <TypePills types={engagement.types} />
        </div>

        {/* 4. Status */}
        <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <Badge variant={STATUS_BADGE[engagement.status] ?? "neutral"}>
            {STATUS_LABEL[engagement.status] ?? engagement.status}
          </Badge>
        </div>

        {/* 5. Last Updated */}
        <div style={{ fontSize: 12, color: "var(--color-gray-400)", whiteSpace: "nowrap", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {formatRelativeTime(engagement.updated_at)}
        </div>

        {/* Manage */}
        {(canEdit || canArchive || canDelete) && (
          <ManageDropdown
            onEdit={onEdit}
            onChangeStatus={onChangeStatus}
            onUnlinkReport={() => setUnlinkOpen(true)}
            onArchive={onArchive}
            onDelete={onDelete}
            canArchive={canArchive}
            canDelete={canDelete}
            canEdit={canEdit}
          />
        )}
      </div>

      <UnlinkReportModal
        isOpen={unlinkOpen}
        engagementId={engagement.id}
        onClose={() => setUnlinkOpen(false)}
        onSuccess={() => setUnlinkOpen(false)}
      />

      {/* Expanded area */}
      {isExpanded && (
        <div style={{ borderTop: "1px solid var(--color-gray-100)", padding: "16px 18px 18px" }}>

          {/* Engagement Details */}
          <p style={sectionLabel}>Engagement Details</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 32px", marginBottom: 14 }}>
            <div>
              <div style={infoLabel}>Lead Consultant</div>
              <div style={infoValue}>
                {engagement.engagement_lead_id
                  ? (userMap.get(engagement.engagement_lead_id)?.username ?? "—")
                  : "—"}
              </div>
            </div>
            <div>
              <div style={infoLabel}>Engagement Type</div>
              <div style={{ marginTop: 4 }}>
                <TypePills types={engagement.types} />
              </div>
            </div>
            <div>
              <div style={infoLabel}>Consultants</div>
              <div style={infoValue}>
                {engagement.consultant_ids && engagement.consultant_ids.length > 0
                  ? engagement.consultant_ids
                      .map((id) => userMap.get(id)?.username ?? id.slice(0, 8) + "…")
                      .join(", ")
                  : "—"}
              </div>
            </div>
            <div>
              <div style={infoLabel}>Status</div>
              <div style={{ marginTop: 4 }}>
                <Badge variant={STATUS_BADGE[engagement.status] ?? "neutral"}>
                  {STATUS_LABEL[engagement.status] ?? engagement.status}
                </Badge>
              </div>
            </div>
            <div>
              <div style={infoLabel}>Start Date</div>
              <div style={infoValue}>{formatDate(engagement.start_date)}</div>
            </div>
            <div>
              <div style={infoLabel}>End Date</div>
              <div style={infoValue}>{formatDate(engagement.end_date)}</div>
            </div>
            <div>
              <div style={infoLabel}>Completed Date</div>
              <div style={infoValue}>{formatDate(engagement.completed_date)}</div>
            </div>
          </div>
          {(engagement.scope_description) && (
            <div style={{ marginBottom: 20 }}>
              <div style={infoLabel}>Details / Scope</div>
              <div style={{ ...infoValue, marginTop: 6, lineHeight: 1.7, whiteSpace: "pre-line" }}>
                {engagement.scope_description}
              </div>
            </div>
          )}
          {!engagement.scope_description && (
            <div style={{ marginBottom: 20 }}>
              <div style={infoLabel}>Details / Scope</div>
              <div style={{ fontSize: 13, color: "var(--color-gray-400)", fontStyle: "italic", marginTop: 4 }}>No engagement details provided.</div>
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--color-gray-100)", marginBottom: 16 }} />

          {/* Reports */}
          <p style={sectionLabel}>Reports</p>
          <EngagementReports engagementId={engagement.id} canCreate={canCreateReport} canEdit={canEdit} />
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type SortMode = "updated" | "start_date" | "name-asc";

const FILTER_STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "scoping", label: "Scoping" },
  { value: "active", label: "Active" },
  { value: "in_review", label: "In Review" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

const FILTER_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "pentest", label: "Pentest" },
  { value: "gap_assessment", label: "Gap Assessment" },
  { value: "vulnerability_assessment", label: "Vulnerability Assessment" },
  { value: "tabletop", label: "Tabletop" },
  { value: "tsa_directive", label: "TSA Directive" },
  { value: "compliance_assessment", label: "Compliance Assessment" },
];

export function EngagementsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const canCreate = usePermission("engagement", "create");
  const canEdit = usePermission("engagement", "edit");
  const canArchive = usePermission("engagement", "archive");
  const canDelete = usePermission("engagement", "delete");
  const canCreateReport = usePermission("report", "create");

  const [search, setSearch] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterType, setFilterType] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>("updated");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingEngagement, setEditingEngagement] = React.useState<Engagement | null>(null);
  const [statusTarget, setStatusTarget] = React.useState<Engagement | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<Engagement | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Engagement | null>(null);
  const [defaultClientId, setDefaultClientId] = React.useState<string | undefined>(undefined);
  const didAutoExpand = React.useRef(false);

  const { data: engagements = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["engagements"],
    queryFn: () => getEngagements(),
    staleTime: 120_000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients,
    staleTime: 120_000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    staleTime: 120_000,
  });

  const clientMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    clients.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [clients]);

  const userMap = React.useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users]
  );

  // Auto-expand / newFor from URL params — once only
  React.useEffect(() => {
    if (didAutoExpand.current) return;
    const expandId = searchParams.get("expand");
    const newFor = searchParams.get("newFor");

    if (expandId && engagements.length > 0 && engagements.find((e) => e.id === expandId)) {
      setExpandedId(expandId);
      didAutoExpand.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete("expand");
      window.history.replaceState({}, "", url.toString());
    } else if (newFor) {
      setDefaultClientId(newFor);
      setEditingEngagement(null);
      setFormOpen(true);
      didAutoExpand.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete("newFor");
      window.history.replaceState({}, "", url.toString());
    }
  }, [engagements, searchParams]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return engagements.filter((e) => {
      if (filterStatus && e.status !== filterStatus) return false;
      if (filterType && !e.types.includes(filterType as EngagementType)) return false;
      if (q) {
        const clientName = clientMap[e.client_id]?.toLowerCase() ?? "";
        if (!e.title.toLowerCase().includes(q) && !clientName.includes(q)) return false;
      }
      return true;
    });
  }, [engagements, filterStatus, filterType, search, clientMap]);

  const sorted = React.useMemo(() => {
    const copy = [...filtered];
    if (sortMode === "name-asc") copy.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortMode === "start_date") {
      copy.sort((a, b) => {
        if (!a.start_date && !b.start_date) return 0;
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      });
    } else {
      copy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return copy;
  }, [filtered, sortMode]);

  const handleToggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archiveEngagement(archiveTarget.id);
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
      if (expandedId === archiveTarget.id) setExpandedId(null);
      toast.success("Engagement archived");
    } catch {
      toast.error("Failed to archive engagement. Please try again.");
    } finally {
      setArchiveTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEngagement(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
      if (expandedId === deleteTarget.id) setExpandedId(null);
      toast.success("Engagement deleted");
    } catch {
      toast.error("Failed to delete engagement. Please try again.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const filterSelectStyle: React.CSSProperties = {
    fontSize: 12, padding: "5px 8px", borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-gray-200)", background: "var(--color-white)",
    color: "var(--color-gray-700)", cursor: "pointer",
  };

  const actions = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {canArchive && (
        <button
          onClick={() => navigate("/engagements/archive")}
          style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-500)", background: "none", border: "none", cursor: "pointer", padding: "4px 2px", textDecoration: "underline" }}
        >
          View Archive
        </button>
      )}
      {canCreate && (
        <Button variant="primary" onClick={() => { setDefaultClientId(undefined); setEditingEngagement(null); setFormOpen(true); }}>
          + New Engagement
        </Button>
      )}
    </div>
  );

  return (
    <PageWrapper title="Engagements" actions={actions}>
      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "24px 1fr 160px 1fr auto auto",
          gap: 16,
          padding: "0 16px 8px",
          borderBottom: "1px solid var(--color-gray-200)",
          marginBottom: 8,
        }}
      >
        {["", "Engagement", "Customer", "Type", "Status", "Last Updated"].map((h) => (
          <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {h}
          </span>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", maxWidth: 320 }}>
          <Input placeholder="Search engagements or client…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={filterSelectStyle}>
          {FILTER_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={filterSelectStyle}>
          {FILTER_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>Sort:</span>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} style={filterSelectStyle}>
            <option value="updated">Last Updated</option>
            <option value="start_date">Start Date</option>
            <option value="name-asc">Name (A–Z)</option>
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : isError ? (
        <ErrorState message="Failed to load engagements." onRetry={refetch} />
      ) : sorted.length === 0 ? (
        <EmptyState
          title={search || filterStatus || filterType ? "No engagements match your filters." : "No engagements yet."}
          action={
            canCreate && !search && !filterStatus && !filterType
              ? { label: "+ New Engagement", onClick: () => { setDefaultClientId(undefined); setEditingEngagement(null); setFormOpen(true); } }
              : undefined
          }
        />
      ) : (
        sorted.map((eng) => (
          <EngagementRow
            key={eng.id}
            engagement={eng}
            clientName={clientMap[eng.client_id] ?? ""}
            isExpanded={expandedId === eng.id}
            onToggle={() => handleToggle(eng.id)}
            onEdit={() => { setEditingEngagement(eng); setDefaultClientId(undefined); setFormOpen(true); }}
            onChangeStatus={() => setStatusTarget(eng)}
            onArchive={() => setArchiveTarget(eng)}
            onDelete={() => setDeleteTarget(eng)}
            canEdit={canEdit}
            canArchive={canArchive}
            canDelete={canDelete}
            canCreateReport={canCreateReport}
            userMap={userMap}
          />
        ))
      )}

      <EngagementFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setDefaultClientId(undefined); }}
        engagement={editingEngagement ?? undefined}
        defaultClientId={defaultClientId}
        onSuccess={(saved) => {
          setFormOpen(false);
          setDefaultClientId(undefined);
          toast.success(editingEngagement ? "Engagement updated" : "Engagement created");
          if (!editingEngagement) setExpandedId(saved.id);
        }}
      />

      <StatusChangeModal
        isOpen={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        engagement={statusTarget ?? undefined}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["engagements"] });
          setStatusTarget(null);
        }}
      />

      <ConfirmModal
        isOpen={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        title="Archive Engagement"
        message={`Archive "${archiveTarget?.title}"? It will be hidden from the active list and can be restored from the archive.`}
        confirmLabel="Archive"
        confirmVariant="danger"
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Engagement"
        message={`Delete "${deleteTarget?.title}"? This will permanently remove the engagement and all associated reports.`}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </PageWrapper>
  );
}
