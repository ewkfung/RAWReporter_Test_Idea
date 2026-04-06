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
import {
  getArchivedEngagements,
  restoreEngagement,
  deleteEngagement,
} from "../../api/engagements";
import { listUsers } from "../../api/users";
import { formatDate } from "../../utils/formatting";
import { TypePills, TYPE_LABEL } from "./EngagementsPage";
import type { Engagement, EngagementStatus } from "../../types/models";
import type { BadgeVariant } from "../../components/ui/Badge";

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

export function EngagementArchivePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const canArchive = usePermission("engagement", "archive");
  const canDelete = usePermission("engagement", "delete");

  const [deleteTarget, setDeleteTarget] = React.useState<Engagement | null>(null);

  const { data: engagements = [], isLoading } = useQuery({
    queryKey: ["engagements-archived"],
    queryFn: getArchivedEngagements,
    enabled: canArchive,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    staleTime: 120_000,
    enabled: canArchive,
  });

  const userMap = React.useMemo(
    () => new Map(users.map((u) => [u.id, u.username])),
    [users]
  );

  if (!canArchive) {
    return <Navigate to="/engagements" replace />;
  }

  const handleRestore = async (engagement: Engagement) => {
    await restoreEngagement(engagement.id);
    queryClient.invalidateQueries({ queryKey: ["engagements-archived"] });
    queryClient.invalidateQueries({ queryKey: ["engagements"] });
    toast.success("Engagement restored");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteEngagement(deleteTarget.id);
    queryClient.invalidateQueries({ queryKey: ["engagements-archived"] });
    toast.success("Engagement permanently deleted");
    setDeleteTarget(null);
  };

  return (
    <PageWrapper
      title="Archived Engagements"
      breadcrumbs={[
        { label: "Engagements", to: "/engagements" },
        { label: "Archive" },
      ]}
    >
      <button
        onClick={() => navigate("/engagements")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 500, color: "var(--color-gray-500)",
          background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 20,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Engagements
      </button>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <Spinner size={32} />
        </div>
      ) : engagements.length === 0 ? (
        <EmptyState title="No archived engagements." />
      ) : (
        <div>
          {engagements.map((eng) => (
            <ArchivedEngagementRow
              key={eng.id}
              engagement={eng}
              canDelete={canDelete}
              onRestore={handleRestore}
              onDelete={(e) => setDeleteTarget(e)}
              userMap={userMap}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Engagement Permanently"
        message={`Permanently delete "${deleteTarget?.title}"? This will remove the engagement and all associated reports. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
      />
    </PageWrapper>
  );
}

// ── Row component ──────────────────────────────────────────────────────────

function ArchivedEngagementRow({
  engagement,
  canDelete,
  onRestore,
  onDelete,
  userMap,
}: {
  engagement: Engagement;
  canDelete: boolean;
  onRestore: (e: Engagement) => Promise<void>;
  onDelete: (e: Engagement) => void;
  userMap: Map<string, string>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);

  const infoLabel: React.CSSProperties = {
    fontSize: 11, color: "var(--color-gray-400)", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.04em",
  };
  const infoValue: React.CSSProperties = {
    fontSize: 13, color: "var(--color-gray-700)", marginTop: 2,
  };

  const handleRestore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRestoring(true);
    try { await onRestore(engagement); } finally { setRestoring(false); }
  };

  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-200)",
        borderRadius: "var(--radius-md)",
        marginBottom: 6,
        opacity: 0.85,
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px", cursor: "pointer", userSelect: "none",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          style={{
            flexShrink: 0, color: "var(--color-gray-400)", transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-flex",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>

        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--color-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {engagement.title}
        </span>

        <TypePills types={engagement.types} />

        <Badge variant={STATUS_BADGE[engagement.status] ?? "neutral"}>
          {STATUS_LABEL[engagement.status] ?? engagement.status}
        </Badge>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {engagement.archived_at && (
            <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
              Archived {formatDate(engagement.archived_at)}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={handleRestore} loading={restoring}>Restore</Button>
          {canDelete && (
            <Button variant="danger" size="sm" onClick={() => onDelete(engagement)}>Delete Permanently</Button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--color-gray-100)", padding: "14px 38px 16px", background: "var(--color-gray-50)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
            {engagement.engagement_lead_id && (
              <div>
                <div style={infoLabel}>Lead Consultant</div>
                <div style={infoValue}>{userMap.get(engagement.engagement_lead_id) ?? "—"}</div>
              </div>
            )}
            <div>
              <div style={infoLabel}>Start Date</div>
              <div style={infoValue}>{formatDate(engagement.start_date)}</div>
            </div>
            <div>
              <div style={infoLabel}>End Date</div>
              <div style={infoValue}>{formatDate(engagement.end_date)}</div>
            </div>
            {engagement.types.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={infoLabel}>Type(s)</div>
                <div style={{ marginTop: 6 }}>
                  {engagement.types.map((t) => (
                    <span key={t} style={{ fontSize: 12, marginRight: 6, color: "var(--color-gray-600)" }}>{TYPE_LABEL[t] ?? t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
