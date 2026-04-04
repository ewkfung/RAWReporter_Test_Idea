import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Button } from "../../components/ui/Button";
import { SeverityBadge, Badge } from "../../components/ui/Badge";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { usePermission } from "../../hooks/usePermission";
import { useToast } from "../../components/ui/useToast";
import {
  getArchivedLibraryFindings,
  restoreLibraryFinding,
  deleteLibraryFinding,
} from "../../api/library";
import type { LibraryFinding } from "../../types/models";

export function LibraryArchivePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const canArchive = usePermission("library_finding", "archive");
  const canRestore = usePermission("library_finding", "restore");
  const canDelete = usePermission("library_finding", "delete");

  const [deleteTarget, setDeleteTarget] = React.useState<LibraryFinding | null>(null);

  const { data: findings = [], isLoading } = useQuery({
    queryKey: ["library-archived"],
    queryFn: getArchivedLibraryFindings,
    enabled: canArchive,
  });

  // Guard: redirect to library if user lacks archive permission
  if (!canArchive) {
    return <Navigate to="/library" replace />;
  }

  const handleRestore = async (finding: LibraryFinding) => {
    await restoreLibraryFinding(finding.id);
    queryClient.invalidateQueries({ queryKey: ["library-archived"] });
    queryClient.invalidateQueries({ queryKey: ["library"] });
    toast.success("Finding restored to library");
  };

  const handleDelete = async (finding: LibraryFinding) => {
    await deleteLibraryFinding(finding.id);
    queryClient.invalidateQueries({ queryKey: ["library-archived"] });
    toast.success("Finding permanently deleted");
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <PageWrapper
      title="Archived Findings"
      breadcrumbs={[
        { label: "Library", to: "/library" },
        { label: "Archive" },
      ]}
    >
      {/* Back link */}
      <button
        onClick={() => navigate("/library")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-gray-500)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          marginBottom: 20,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Library
      </button>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <Spinner size={32} />
        </div>
      ) : findings.length === 0 ? (
        <EmptyState title="No archived findings." />
      ) : (
        <div>
          {findings.map((f) => (
            <ArchivedFindingRow
              key={f.id}
              finding={f}
              canRestore={canRestore}
              canDelete={canDelete}
              onRestore={handleRestore}
              onDelete={(finding) => setDeleteTarget(finding)}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        title="Delete Permanently"
        message={`Permanently delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
      />
    </PageWrapper>
  );
}

// ── Row component ──────────────────────────────────────────────────────────

function ArchivedFindingRow({
  finding,
  canRestore,
  canDelete,
  onRestore,
  onDelete,
  formatDate,
}: {
  finding: LibraryFinding;
  canRestore: boolean;
  canDelete: boolean;
  onRestore: (f: LibraryFinding) => Promise<void>;
  onDelete: (f: LibraryFinding) => void;
  formatDate: (iso: string) => string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);

  const handleRestore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRestoring(true);
    try {
      await onRestore(finding);
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
        overflow: "hidden",
        opacity: 0.85,
      }}
    >
      {/* Row header */}
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

        {/* Right side controls */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {finding.archived_at && (
            <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
              Archived {formatDate(finding.archived_at)}
            </span>
          )}
          {canRestore && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRestore}
              loading={restoring}
            >
              Restore
            </Button>
          )}
          {canDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDelete(finding)}
            >
              Delete Permanently
            </Button>
          )}
        </div>
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {finding.framework_refs.map((ref) => (
              <Badge key={ref} variant="neutral" style={{ fontSize: 11 }}>{ref}</Badge>
            ))}
            {finding.is_ot_specific && (
              <Badge variant="blue" style={{ fontSize: 11 }}>OT Specific</Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
