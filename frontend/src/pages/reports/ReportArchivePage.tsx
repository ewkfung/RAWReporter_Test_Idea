/**
 * ReportArchivePage — displays soft-archived reports at /reports/archive.
 *
 * Only accessible to users with the report:archive permission.
 * Redirects to /reports if the user lacks that permission.
 *
 * Each archived report row shows title, customer, engagement, type, status,
 * archived date, and two actions:
 *   - Restore — moves the report back to the active list
 *   - Delete Permanently — hard-deletes the report and all its data
 *
 * This follows the same archive pattern used in Library and Engagements.
 */

import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { usePermission } from "../../hooks/usePermission";
import { useToast } from "../../components/ui/useToast";
import { getArchivedReports, restoreReport, deleteReport } from "../../api/reports";
import { getEngagements } from "../../api/engagements";
import { getClients } from "../../api/clients";
import type { Report, ReportStatus, EngagementType } from "../../types/models";
import type { BadgeVariant } from "../../components/ui/Badge";

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

const TYPE_LABEL: Record<EngagementType, string> = {
  pentest: "Pentest",
  gap_assessment: "Gap Assessment",
  vulnerability_assessment: "Vulnerability Assessment",
  tabletop: "Tabletop",
  tsa_directive: "TSA Directive",
  compliance_assessment: "Compliance Assessment",
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export function ReportArchivePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const canArchive = usePermission("report", "archive");
  const canDelete = usePermission("report", "delete");

  const [deleteTarget, setDeleteTarget] = React.useState<Report | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports-archived"],
    queryFn: getArchivedReports,
    enabled: canArchive,
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

  if (!canArchive) {
    return <Navigate to="/reports" replace />;
  }

  const handleRestore = async (report: Report) => {
    await restoreReport(report.id);
    queryClient.invalidateQueries({ queryKey: ["reports-archived"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    toast.success("Report restored");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteReport(deleteTarget.id);
    queryClient.invalidateQueries({ queryKey: ["reports-archived"] });
    toast.success("Report permanently deleted");
    setDeleteTarget(null);
  };

  return (
    <PageWrapper
      title="Archived Reports"
      breadcrumbs={[
        { label: "Reports", to: "/reports" },
        { label: "Archive" },
      ]}
    >
      {/* Back link */}
      <button
        onClick={() => navigate("/reports")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 500, color: "var(--color-gray-500)",
          background: "none", border: "none", cursor: "pointer",
          padding: 0, marginBottom: 20,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Reports
      </button>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <Spinner size={32} />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState title="No archived reports." />
      ) : (
        <div>
          {reports.map((report) => {
            const eng = report.engagement_id ? engagementMap[report.engagement_id] : undefined;
            const clientName = eng ? (clientMap[eng.client_id] ?? "") : "";
            const typeName = report.types?.[0]
              ? (TYPE_LABEL[report.types[0] as EngagementType] ?? report.types[0])
              : "—";

            return (
              <ArchivedReportRow
                key={report.id}
                report={report}
                clientName={clientName}
                engagementName={eng?.title ?? "—"}
                typeName={typeName}
                canDelete={canDelete}
                onRestore={handleRestore}
                onDelete={() => setDeleteTarget(report)}
              />
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { await handleDelete(); }}
        title="Delete Permanently"
        message={`Permanently delete "${deleteTarget?.title}"? All findings, sections, and evidence will be removed. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
      />
    </PageWrapper>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────
// Each archived report is shown as a flat (non-expandable) row with its key
// metadata and restore / delete actions.

function ArchivedReportRow({
  report,
  clientName,
  engagementName,
  typeName,
  canDelete,
  onRestore,
  onDelete,
}: {
  report: Report;
  clientName: string;
  engagementName: string;
  typeName: string;
  canDelete: boolean;
  onRestore: (r: Report) => Promise<void>;
  onDelete: (r: Report) => void;
}) {
  const [restoring, setRestoring] = React.useState(false);

  const handleRestore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRestoring(true);
    try {
      await onRestore(report);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-200)",
        borderRadius: "var(--radius-md)",
        marginBottom: 6,
        opacity: 0.85,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-gray-900)", marginBottom: 3 }}>
          {report.title}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-gray-500)", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span>{clientName || "—"}</span>
          <span style={{ color: "var(--color-gray-300)" }}>·</span>
          <span>{engagementName}</span>
          {typeName !== "—" && (
            <>
              <span style={{ color: "var(--color-gray-300)" }}>·</span>
              <span>{typeName}</span>
            </>
          )}
        </div>
      </div>

      {/* Status */}
      <Badge variant={STATUS_BADGE[report.status] ?? "neutral"}>
        {STATUS_LABEL[report.status] ?? report.status}
      </Badge>

      {/* Archived date */}
      {report.archived_at && (
        <span style={{ fontSize: 12, color: "var(--color-gray-400)", whiteSpace: "nowrap" }}>
          Archived {formatDate(report.archived_at)}
        </span>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <Button variant="secondary" size="sm" onClick={handleRestore} loading={restoring}>
          Restore
        </Button>
        {canDelete && (
          <Button variant="danger" size="sm" onClick={() => onDelete(report)}>
            Delete Permanently
          </Button>
        )}
      </div>
    </div>
  );
}
