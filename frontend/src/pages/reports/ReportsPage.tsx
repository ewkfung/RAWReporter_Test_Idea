/**
 * ReportsPage — flat list of all active reports across all engagements.
 *
 * This is a quick-access view. Clicking any row opens the Report Builder
 * directly (/reports/:id/build). Reports can also be created here directly
 * without needing to navigate to an engagement first.
 *
 * Each row shows: Report Name, Customer, Type, Status, Last Updated, End Date.
 * The Manage dropdown per row allows: Edit, Status Update, Archive, Delete.
 *
 * Archived reports are accessible via the "View Archive" link → /reports/archive.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { SkeletonTable } from "../../components/loading/SkeletonTable";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { Button } from "../../components/ui/Button";
import { ReportFormModal } from "../../components/reports/ReportFormModal";
import { usePermission } from "../../hooks/usePermission";
import { useToast } from "../../components/ui/useToast";
import { getReports, archiveReport, updateReport, deleteReport } from "../../api/reports";
import { getEngagements } from "../../api/engagements";
import { getClients } from "../../api/clients";
import { formatRelativeTime } from "../../utils/formatting";
import type { Report, ReportStatus, EngagementType } from "../../types/models";
import type { BadgeVariant } from "../../components/ui/Badge";

// ── Display config maps ────────────────────────────────────────────────────
// Maps status/type values to badge variants and display labels

const STATUS_BADGE: Record<ReportStatus, BadgeVariant> = {
  draft: "neutral",
  review: "warning",
  editing: "blue",
  final_review: "warning",
  complete: "success",
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Draft",
  review: "Review",
  editing: "Editing",
  final_review: "Final Review",
  complete: "Complete",
};

const STATUS_BORDER: Record<ReportStatus, string> = {
  draft: "var(--color-gray-300)",
  review: "var(--color-warning, #d97706)",
  editing: "var(--color-primary, #2563eb)",
  final_review: "var(--color-warning, #d97706)",
  complete: "var(--color-success, #16a34a)",
};

const TYPE_LABEL: Record<EngagementType, string> = {
  pentest: "Pentest",
  gap_assessment: "Gap Assessment",
  vulnerability_assessment: "Vulnerability Assessment",
  tabletop: "Tabletop",
  tsa_directive: "TSA Directive",
  compliance_assessment: "Compliance Assessment",
  risk: "Risk Assessment",
};

// ── Status Update Modal ────────────────────────────────────────────────────
// Lightweight modal for changing just the report status without opening the full edit form

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "editing", label: "Editing" },
  { value: "final_review", label: "Final Review" },
  { value: "complete", label: "Complete" },
];

function StatusUpdateModal({
  isOpen,
  report,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  report: Report | null;
  onClose: () => void;
  onSave: (id: string, status: string) => Promise<void>;
}) {
  const [status, setStatus] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && report) setStatus(report.status);
  }, [isOpen, report]);

  if (!isOpen || !report) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(report.id, status);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    fontSize: 14,
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-gray-300)",
    background: "var(--color-white)",
    color: "var(--color-gray-900)",
    marginTop: 4,
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-white)", borderRadius: "var(--radius-md)",
          padding: 24, width: "min(90vw, 380px)", boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Update Status</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-gray-500)" }}>
          {report.title}
        </p>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-gray-600)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Update
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Manage Dropdown ────────────────────────────────────────────────────────
// Per-row dropdown with Edit, Status Update, Archive, and Delete options.
// Each option is conditionally rendered based on the user's permissions.

function ManageDropdown({
  onEdit,
  onStatusUpdate,
  onArchive,
  onDelete,
  canEdit,
  canArchive,
  canDelete,
}: {
  onEdit: () => void;
  onStatusUpdate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canArchive: boolean;
  canDelete: boolean;
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

  if (!canEdit && !canArchive && !canDelete) return null;

  return (
    <div ref={ref} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "4px 10px", fontSize: 12, fontWeight: 500,
          color: "var(--color-gray-600)", background: "var(--color-gray-50)",
          border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
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
            position: "absolute", right: 0, top: "calc(100% + 4px)",
            background: "var(--color-white)", border: "1px solid var(--color-gray-200)",
            borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)",
            zIndex: 200, minWidth: 150, overflow: "hidden",
          }}
        >
          {canEdit && (
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              style={menuItemStyle()}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              Edit
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => { setOpen(false); onStatusUpdate(); }}
              style={menuItemStyle()}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              Status Update
            </button>
          )}
          {canArchive && (
            <button
              onClick={() => { setOpen(false); onArchive(); }}
              style={menuItemStyle("var(--color-warning, #d97706)")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              Archive
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              style={menuItemStyle("var(--color-danger)")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              Delete
            </button>
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

// ── Report Row ─────────────────────────────────────────────────────────────
// A single non-expandable row. Clicking anywhere (except the manage dropdown)
// navigates to the Report Builder. The left border colour reflects the status.

function ReportRow({
  report,
  engagementName: _engagementName,
  clientName,
  onEdit,
  onStatusUpdate,
  onArchive,
  onDelete,
  canEdit,
  canArchive,
  canDelete,
}: {
  report: Report;
  engagementName: string;
  clientName: string;
  onEdit: () => void;
  onStatusUpdate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canArchive: boolean;
  canDelete: boolean;
}) {
  const navigate = useNavigate();
  const borderColor = STATUS_BORDER[report.status] ?? "var(--color-gray-300)";
  const typeName = report.types?.[0] ? (TYPE_LABEL[report.types[0] as EngagementType] ?? report.types[0]) : "—";

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-200)",
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: "var(--radius-md)",
        marginBottom: 8,
        cursor: "pointer",
        transition: "box-shadow 0.15s",
      }}
      onClick={() => navigate(`/reports/${report.id}/build`)}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-sm, 0 1px 4px rgba(0,0,0,0.08))")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(180px,2fr) minmax(140px,1.2fr) minmax(160px,1.5fr) 110px 120px 100px 110px 88px",
          alignItems: "center",
          gap: 20,
          padding: "14px 20px",
        }}
      >
        {/* Report Name */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "var(--color-gray-900)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {report.title}
          </div>
        </div>

        {/* Customer */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13, color: "var(--color-gray-600)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {clientName || "—"}
          </div>
        </div>

        {/* Type */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13, color: "var(--color-gray-600)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {typeName}
          </div>
        </div>

        {/* Status */}
        <div onClick={(e) => e.stopPropagation()} style={{ pointerEvents: "none" }}>
          <Badge variant={STATUS_BADGE[report.status] ?? "neutral"}>
            {STATUS_LABEL[report.status] ?? report.status}
          </Badge>
        </div>

        {/* Last Updated */}
        <div style={{ fontSize: 12, color: "var(--color-gray-400)", whiteSpace: "nowrap" }}
          onClick={(e) => e.stopPropagation()}
        >
          {formatRelativeTime(report.updated_at)}
        </div>

        {/* End Date */}
        <div style={{ fontSize: 12, color: "var(--color-gray-500)", whiteSpace: "nowrap" }}
          onClick={(e) => e.stopPropagation()}
        >
          {formatDate(report.end_date)}
        </div>

        {/* Open Builder */}
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => { e.stopPropagation(); navigate(`/reports/${report.id}/build`); }}
        >
          Open Builder
        </Button>

        {/* Manage */}
        <ManageDropdown
          onEdit={onEdit}
          onStatusUpdate={onStatusUpdate}
          onArchive={onArchive}
          onDelete={onDelete}
          canEdit={canEdit}
          canArchive={canArchive}
          canDelete={canDelete}
        />
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
// Fetches reports, engagements, and clients in parallel, then builds lookup
// maps so each row can display Customer and Engagement names without extra requests.

type SortMode = "updated" | "name-asc";
type FilterStatus = "" | ReportStatus;

export function ReportsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const canCreate = usePermission("report", "create");
  const canEdit = usePermission("report", "edit");
  const canArchive = usePermission("report", "archive");
  const canDelete = usePermission("report", "delete");

  const [search, setSearch] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("");
  const [sortMode, setSortMode] = React.useState<SortMode>("updated");

  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Report | null>(null);
  const [statusTarget, setStatusTarget] = React.useState<Report | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<Report | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Report | null>(null);

  const { data: reports = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["reports"],
    queryFn: () => getReports(),
    staleTime: 120_000,
  });

  const { data: engagements = [] } = useQuery({
    queryKey: ["engagements"],
    queryFn: () => getEngagements(),
    staleTime: 120_000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients,
    staleTime: 120_000,
  });

  const engagementMap = React.useMemo(() => {
    const m: Record<string, { title: string; client_id: string }> = {};
    engagements.forEach((e) => (m[e.id] = { title: e.title, client_id: e.client_id }));
    return m;
  }, [engagements]);

  const clientMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    clients.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [clients]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return reports.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (q) {
        const eng = r.engagement_id ? engagementMap[r.engagement_id] : undefined;
        const engName = eng?.title?.toLowerCase() ?? "";
        const clientName = eng ? (clientMap[eng.client_id]?.toLowerCase() ?? "") : "";
        if (!r.title.toLowerCase().includes(q) && !engName.includes(q) && !clientName.includes(q)) return false;
      }
      return true;
    });
  }, [reports, filterStatus, search, engagementMap, clientMap]);

  const sorted = React.useMemo(() => {
    const copy = [...filtered];
    if (sortMode === "name-asc") copy.sort((a, b) => a.title.localeCompare(b.title));
    else copy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return copy;
  }, [filtered, sortMode]);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateReport(id, { status });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success(`Status updated to ${STATUS_LABEL[status as ReportStatus] ?? status}`);
    } catch {
      toast.error("Failed to update status. Please try again.");
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archiveReport(archiveTarget.id);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["reports-archived"] });
      toast.success("Report archived");
    } catch {
      toast.error("Failed to archive report. Please try again.");
    } finally {
      setArchiveTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteReport(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Report deleted");
    } catch {
      toast.error("Failed to delete report. Please try again.");
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
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {canArchive && (
        <button
          onClick={() => navigate("/reports/archive")}
          style={{
            fontSize: 13, color: "var(--color-gray-500)", background: "none",
            border: "none", cursor: "pointer", padding: 0, textDecoration: "underline",
          }}
        >
          View Archive
        </button>
      )}
      {canCreate && (
        <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
          + New Report
        </Button>
      )}
    </div>
  );

  return (
    <PageWrapper title="Reports" actions={actions}>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(180px,2fr) minmax(140px,1.2fr) minmax(160px,1.5fr) 110px 120px 100px 110px 88px",
          gap: 20,
          padding: "0 20px 8px",
          borderBottom: "1px solid var(--color-gray-200)",
          marginBottom: 8,
        }}
      >
        {["Report Name", "Customer", "Type", "Status", "Last Updated", "End Date", "", ""].map((h, i) => (
          <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {h}
          </span>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", maxWidth: 340 }}>
          <Input
            placeholder="Search by name, customer, or engagement…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          style={filterSelectStyle}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="editing">Editing</option>
          <option value="final_review">Final Review</option>
          <option value="complete">Complete</option>
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>Sort:</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            style={filterSelectStyle}
          >
            <option value="updated">Last Updated</option>
            <option value="name-asc">Name (A–Z)</option>
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : isError ? (
        <ErrorState message="Failed to load reports." onRetry={refetch} />
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports yet."
          description="Create a new report or open an engagement to add one from there."
          action={canCreate ? { label: "+ New Report", onClick: () => setCreateModalOpen(true) } : undefined}
        />
      ) : sorted.length === 0 ? (
        <EmptyState title="No reports match your search." />
      ) : (
        sorted.map((report) => {
          const eng = report.engagement_id ? engagementMap[report.engagement_id] : undefined;
          const clientName = eng ? (clientMap[eng.client_id] ?? "") : "";
          return (
            <ReportRow
              key={report.id}
              report={report}
              engagementName={eng?.title ?? ""}
              clientName={clientName}
              onEdit={() => setEditTarget(report)}
              onStatusUpdate={() => setStatusTarget(report)}
              onArchive={() => setArchiveTarget(report)}
              onDelete={() => setDeleteTarget(report)}
              canEdit={canEdit}
              canArchive={canArchive}
              canDelete={canDelete}
            />
          );
        })
      )}

      {/* Create modal */}
      <ReportFormModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => setCreateModalOpen(false)}
      />

      {/* Edit modal */}
      <ReportFormModal
        isOpen={editTarget !== null}
        onClose={() => setEditTarget(null)}
        report={editTarget ?? undefined}
        onSuccess={() => setEditTarget(null)}
      />

      {/* Status update modal */}
      <StatusUpdateModal
        isOpen={statusTarget !== null}
        report={statusTarget}
        onClose={() => setStatusTarget(null)}
        onSave={handleStatusUpdate}
      />

      {/* Archive confirm */}
      <ConfirmModal
        isOpen={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        title="Archive Report"
        message={`Archive "${archiveTarget?.title}"? It will be hidden from the reports list and can be restored from the archive.`}
        confirmLabel="Archive"
        confirmVariant="secondary"
      />

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Report"
        message="Deleting this report will permanently remove all findings, sections, and evidence attached to it. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </PageWrapper>
  );
}
