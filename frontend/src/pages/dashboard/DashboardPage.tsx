import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { SkeletonCard } from "../../components/loading/SkeletonCard";
import { usePermission } from "../../hooks/usePermission";
import { useAuthStore } from "../../store/authStore";
import { getClients } from "../../api/clients";
import { getEngagements } from "../../api/engagements";
import { getReports } from "../../api/reports";
import { getLibraryFindings } from "../../api/library";
import { listUsers } from "../../api/users";
import { formatRelativeTime } from "../../utils/formatting";
import type { Engagement, Report } from "../../types/models";
import type { BadgeVariant } from "../../components/ui/Badge";

const STALE = 120_000;

// ── Status badge helpers ────────────────────────────────────────────────────

const ENGAGEMENT_STATUS_BADGE: Record<string, BadgeVariant> = {
  scoping:   "neutral",
  active:    "success",
  in_review: "warning",
  delivered: "blue",
  completed: "success",
  closed:    "neutral",
};

const ENGAGEMENT_STATUS_LABEL: Record<string, string> = {
  scoping:   "Scoping",
  active:    "Active",
  in_review: "In Review",
  delivered: "Delivered",
  completed: "Completed",
  closed:    "Closed",
};

const REPORT_STATUS_BADGE: Record<string, BadgeVariant> = {
  draft:        "neutral",
  review:       "warning",
  editing:      "warning",
  final_review: "blue",
  complete:     "success",
};

const REPORT_STATUS_LABEL: Record<string, string> = {
  draft:        "Draft",
  review:       "In Review",
  editing:      "Editing",
  final_review: "Final Review",
  complete:     "Complete",
};

// ── Date helpers ────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysOverdue(today: Date, dateStr: string): number {
  return Math.floor((today.getTime() - new Date(dateStr).getTime()) / 86_400_000);
}

function endDateColor(today: Date, dateStr: string): string {
  const d = new Date(dateStr);
  if (d < today) return "#dc2626";
  const sevenDays = new Date(today);
  sevenDays.setDate(sevenDays.getDate() + 7);
  if (d <= sevenDays) return "#d97706";
  return "var(--color-gray-500)";
}

// ── Summary card ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  count,
  isLoading,
  icon,
  borderColor,
}: {
  label: string;
  count: number | undefined;
  isLoading: boolean;
  icon: React.ReactNode;
  borderColor: string;
}) {
  return (
    <Card
      hoverable={false}
      style={{ borderLeft: `4px solid ${borderColor}`, flex: "1 1 0", minWidth: 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-md)",
            background: `${borderColor}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: borderColor,
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--color-gray-900)", lineHeight: 1.1 }}>
            {isLoading ? <Spinner size={20} /> : count ?? "—"}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-gray-500)", marginTop: 2 }}>{label}</div>
        </div>
      </div>
    </Card>
  );
}

// ── SVG icons ───────────────────────────────────────────────────────────────

const BuildingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="2" y="4" width="16" height="13" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 17V9M10 17V9M14 17V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M2 8h16" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 4V2h4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ClipboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="4" y="4" width="12" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 4V3a1 1 0 011-1h4a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 9h6M7 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const DocumentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M5 3h7l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 3v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const BookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M4 3h6v14H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 3h6a1 1 0 011 1v12a1 1 0 01-1 1h-6V3z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 3v14" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

// ── Shared panel primitives ──────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: "var(--color-white)",
  border: "1px solid var(--color-gray-200)",
  borderRadius: "var(--radius-md)",
  overflow: "hidden",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--color-gray-500)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 10,
};

function PanelSpinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
      <Spinner size={20} />
    </div>
  );
}

function PanelEmpty({ message }: { message: string }) {
  return (
    <div style={{ padding: "16px 14px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 14, color: "#16a34a" }}>✓</span>
      <span style={{ fontSize: 13, color: "var(--color-gray-500)" }}>{message}</span>
    </div>
  );
}

// ── Notices panel ───────────────────────────────────────────────────────────

function NoticePanel({
  label,
  isLoading,
  items,
  renderItem,
}: {
  label: string;
  isLoading: boolean;
  items: unknown[];
  renderItem: (item: unknown, idx: number, total: number) => React.ReactNode;
}) {
  return (
    <div>
      <p style={sectionLabelStyle}>{label}</p>
      <div style={{ ...panelStyle, borderLeft: "4px solid #d97706" }}>
        {isLoading ? (
          <PanelSpinner />
        ) : items.length === 0 ? (
          <PanelEmpty message="All up to date." />
        ) : (
          items.map((item, idx) => renderItem(item, idx, items.length))
        )}
      </div>
    </div>
  );
}

// ── Upcoming panel ──────────────────────────────────────────────────────────

function UpcomingPanel({
  label,
  isLoading,
  items,
  renderItem,
}: {
  label: string;
  isLoading: boolean;
  items: unknown[];
  renderItem: (item: unknown, idx: number, total: number) => React.ReactNode;
}) {
  return (
    <div>
      <p style={sectionLabelStyle}>{label}</p>
      <div style={panelStyle}>
        {isLoading ? (
          <PanelSpinner />
        ) : items.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--color-gray-400)", margin: 0 }}>No items with a due date.</p>
          </div>
        ) : (
          items.map((item, idx) => renderItem(item, idx, items.length))
        )}
      </div>
    </div>
  );
}

// ── Engagement row renderers ─────────────────────────────────────────────────

function EngagementNoticeRow(
  e: Engagement,
  idx: number,
  total: number,
  today: Date,
  clientMap: Record<string, string>,
  navigate: ReturnType<typeof useNavigate>
) {
  return (
    <div
      key={e.id}
      onClick={() => navigate(`/engagements?expand=${e.id}`)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 14px",
        borderBottom: idx < total - 1 ? "1px solid var(--color-gray-100)" : "none",
        cursor: "pointer",
      }}
      onMouseEnter={(el) => (el.currentTarget.style.background = "var(--color-gray-50)")}
      onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
          {e.title}
        </div>
        <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>{clientMap[e.client_id] ?? "—"}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, padding: "2px 6px", flexShrink: 0, whiteSpace: "nowrap" }}>
        {daysOverdue(today, e.end_date!)}d overdue
      </span>
    </div>
  );
}

function EngagementUpcomingRow(
  e: Engagement,
  idx: number,
  total: number,
  today: Date,
  clientMap: Record<string, string>,
  navigate: ReturnType<typeof useNavigate>
) {
  return (
    <div
      key={e.id}
      onClick={() => navigate(`/engagements?expand=${e.id}`)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 14px",
        borderBottom: idx < total - 1 ? "1px solid var(--color-gray-100)" : "none",
        cursor: "pointer",
      }}
      onMouseEnter={(el) => (el.currentTarget.style.background = "var(--color-gray-50)")}
      onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <Badge variant={ENGAGEMENT_STATUS_BADGE[e.status] ?? "neutral"}>
            {ENGAGEMENT_STATUS_LABEL[e.status] ?? e.status}
          </Badge>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {e.title}
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>{clientMap[e.client_id] ?? "—"}</span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: endDateColor(today, e.end_date!), flexShrink: 0, whiteSpace: "nowrap" }}>
        {formatDate(e.end_date!)}
      </span>
    </div>
  );
}

function EngagementRecentRow(
  e: Engagement,
  idx: number,
  total: number,
  clientMap: Record<string, string>,
  navigate: ReturnType<typeof useNavigate>
) {
  return (
    <div
      key={e.id}
      onClick={() => navigate(`/engagements?expand=${e.id}`)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 14px",
        borderBottom: idx < total - 1 ? "1px solid var(--color-gray-100)" : "none",
        cursor: "pointer",
      }}
      onMouseEnter={(el) => (el.currentTarget.style.background = "var(--color-gray-50)")}
      onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <Badge variant={ENGAGEMENT_STATUS_BADGE[e.status] ?? "neutral"}>
            {ENGAGEMENT_STATUS_LABEL[e.status] ?? e.status}
          </Badge>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {e.title}
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>{clientMap[e.client_id] ?? "—"}</span>
      </div>
      <span style={{ fontSize: 11, color: "var(--color-gray-400)", flexShrink: 0 }}>
        {formatRelativeTime(e.updated_at)}
      </span>
    </div>
  );
}

// ── Report row renderers ──────────────────────────────────────────────────────

function ReportNoticeRow(
  r: Report,
  idx: number,
  total: number,
  today: Date,
  engagementMap: Record<string, string>,
  navigate: ReturnType<typeof useNavigate>
) {
  return (
    <div
      key={r.id}
      onClick={() => navigate(`/reports/${r.id}/build`)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 14px",
        borderBottom: idx < total - 1 ? "1px solid var(--color-gray-100)" : "none",
        cursor: "pointer",
      }}
      onMouseEnter={(el) => (el.currentTarget.style.background = "var(--color-gray-50)")}
      onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
          {r.title}
        </div>
        <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
          {(r.engagement_id ? engagementMap[r.engagement_id] : null) ?? "—"}
        </span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, padding: "2px 6px", flexShrink: 0, whiteSpace: "nowrap" }}>
        {daysOverdue(today, r.end_date!)}d overdue
      </span>
    </div>
  );
}

function ReportUpcomingRow(
  r: Report,
  idx: number,
  total: number,
  today: Date,
  engagementMap: Record<string, string>,
  navigate: ReturnType<typeof useNavigate>
) {
  return (
    <div
      key={r.id}
      onClick={() => navigate(`/reports/${r.id}/build`)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 14px",
        borderBottom: idx < total - 1 ? "1px solid var(--color-gray-100)" : "none",
        cursor: "pointer",
      }}
      onMouseEnter={(el) => (el.currentTarget.style.background = "var(--color-gray-50)")}
      onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <Badge variant={REPORT_STATUS_BADGE[r.status] ?? "neutral"}>
            {REPORT_STATUS_LABEL[r.status] ?? r.status}
          </Badge>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.title}
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
          {(r.engagement_id ? engagementMap[r.engagement_id] : null) ?? "—"}
        </span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: endDateColor(today, r.end_date!), flexShrink: 0, whiteSpace: "nowrap" }}>
        {formatDate(r.end_date!)}
      </span>
    </div>
  );
}

function ReportRecentRow(
  r: Report,
  idx: number,
  total: number,
  engagementMap: Record<string, string>,
  navigate: ReturnType<typeof useNavigate>
) {
  return (
    <div
      key={r.id}
      onClick={() => navigate(`/reports/${r.id}/build`)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 14px",
        borderBottom: idx < total - 1 ? "1px solid var(--color-gray-100)" : "none",
        cursor: "pointer",
      }}
      onMouseEnter={(el) => (el.currentTarget.style.background = "var(--color-gray-50)")}
      onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Badge variant={REPORT_STATUS_BADGE[r.status] ?? "neutral"}>
            {REPORT_STATUS_LABEL[r.status] ?? r.status}
          </Badge>
          <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
            {(r.engagement_id ? engagementMap[r.engagement_id] : null) ?? "—"}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 11, color: "var(--color-gray-400)", flexShrink: 0 }}>
        {formatRelativeTime(r.updated_at)}
      </span>
    </div>
  );
}

// ── Engagement Roster panel ─────────────────────────────────────────────────

function EngagementRosterPanel({
  label,
  isLoading,
  engagements,
  clientMap,
  userMap,
  navigate,
}: {
  label: string;
  isLoading: boolean;
  engagements: Engagement[];
  clientMap: Record<string, string>;
  userMap: Record<string, string>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <p style={sectionLabelStyle}>{label}</p>
      <div style={panelStyle}>
        {isLoading ? (
          <PanelSpinner />
        ) : engagements.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--color-gray-400)", margin: 0 }}>No engagements found.</p>
          </div>
        ) : (
          engagements.map((e, idx) => {
            const leadName = e.engagement_lead_id
              ? (userMap[e.engagement_lead_id] ?? "Unknown")
              : "Unassigned";
            const consultantNames =
              e.consultant_ids.length > 0
                ? e.consultant_ids.map((id) => userMap[id] ?? "Unknown").join(", ")
                : "None";

            return (
              <div
                key={e.id}
                onClick={() => navigate(`/engagements?expand=${e.id}`)}
                style={{
                  padding: "12px 14px",
                  borderBottom: idx < engagements.length - 1 ? "1px solid var(--color-gray-100)" : "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(el) => (el.currentTarget.style.background = "var(--color-gray-50)")}
                onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
              >
                {/* Top line: status badge + title + client */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Badge variant={ENGAGEMENT_STATUS_BADGE[e.status] ?? "neutral"}>
                    {ENGAGEMENT_STATUS_LABEL[e.status] ?? e.status}
                  </Badge>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.title}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--color-gray-400)", flexShrink: 0 }}>
                    {clientMap[e.client_id] ?? "—"}
                  </span>
                </div>
                {/* Bottom line: team members */}
                <div style={{ display: "flex", alignItems: "center", gap: 20, paddingLeft: 2 }}>
                  <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>
                    <span style={{ fontWeight: 600, color: "var(--color-gray-700)" }}>Lead:</span>{" "}
                    {leadName}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>
                    <span style={{ fontWeight: 600, color: "var(--color-gray-700)" }}>Consultants:</span>{" "}
                    {consultantNames}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Role detection from permissions — all hooks called unconditionally
  const canCreateUsers       = usePermission("user", "create");       // admin only
  const canCreateEngagements = usePermission("engagement", "create"); // admin + lead
  const canCreateFindings    = usePermission("finding", "create");    // admin + lead + consultant
  const canCreateEngagement  = canCreateEngagements; // alias for empty-state button

  const isAdmin      = canCreateUsers;
  const isLead       = !isAdmin && canCreateEngagements;
  const isConsultant = !isAdmin && !isLead && canCreateFindings;
  // view_only: none of the above — sees full admin-style view

  const userId = user?.id ?? "";

  // All data queries — hooks always called, enabled flags control fetching
  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients,
    staleTime: STALE,
  });

  const { data: engagements, isLoading: loadingEngagements, isError: errorEngagements } = useQuery({
    queryKey: ["engagements"],
    queryFn: () => getEngagements(),
    staleTime: STALE,
  });

  const { data: reports, isLoading: loadingReports, isError: errorReports } = useQuery({
    queryKey: ["reports"],
    queryFn: () => getReports(),
    staleTime: STALE,
  });

  const { data: library, isLoading: loadingLibrary } = useQuery({
    queryKey: ["library"],
    queryFn: () => getLibraryFindings(),
    staleTime: STALE,
    enabled: isAdmin || (!isAdmin && !isLead && !isConsultant), // admin + view_only
  });

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    staleTime: STALE,
    enabled: isAdmin || isLead,
  });

  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // User name lookup map
  const userMap = React.useMemo<Record<string, string>>(() => {
    if (!users) return {};
    return Object.fromEntries(users.map((u) => [u.id, `${u.first_name} ${u.last_name}`.trim() || u.username]));
  }, [users]);

  // ── Scoped engagement / report sets (for lead + consultant) ──────────────

  const myEngagements = React.useMemo(() =>
    engagements?.filter(
      (e) => e.engagement_lead_id === userId || e.consultant_ids.includes(userId)
    ) ?? [],
    [engagements, userId]
  );

  const myEngagementIds = React.useMemo(
    () => new Set(myEngagements.map((e) => e.id)),
    [myEngagements]
  );

  const myReports = React.useMemo(() =>
    reports?.filter((r) => r.engagement_id && myEngagementIds.has(r.engagement_id)) ?? [],
    [reports, myEngagementIds]
  );

  // My engagements that I lead (for lead roster panel)
  const myLedEngagements = React.useMemo(() =>
    myEngagements.filter((e) => e.engagement_lead_id === userId),
    [myEngagements, userId]
  );

  // ── Derived datasets — choose scoped vs global depending on role ──────────

  const engagementPool = (isLead || isConsultant) ? myEngagements : (engagements ?? []);
  const reportPool     = (isLead || isConsultant) ? myReports      : (reports ?? []);

  const PANEL_LIMIT = (isLead || isConsultant) ? 5 : 10;

  // Summary counts
  const activeEngagementsCount = engagementPool.filter(
    (e) => e.status === "active" || e.status === "in_review"
  ).length;

  const inProgressReports = reportPool.filter(
    (r) => r.status === "draft" || r.status === "review" || r.status === "editing"
  );

  const clientsCount = React.useMemo(() => {
    if (isLead || isConsultant) {
      return new Set(myEngagements.map((e) => e.client_id)).size;
    }
    return clients?.length ?? 0;
  }, [isLead, isConsultant, myEngagements, clients]);

  // Notice panels — overdue items
  const overdueEngagements = React.useMemo(() =>
    engagementPool
      .filter((e) => e.end_date && !e.completed_date && new Date(e.end_date) < today)
      .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime())
      .slice(0, PANEL_LIMIT),
    [engagementPool, today, PANEL_LIMIT]
  );

  const overdueReports = React.useMemo(() =>
    reportPool
      .filter((r) => r.end_date && !r.completed_date && new Date(r.end_date) < today)
      .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime())
      .slice(0, PANEL_LIMIT),
    [reportPool, today, PANEL_LIMIT]
  );

  // Upcoming panels — sorted by end_date
  const upcomingEngagements = React.useMemo(() =>
    [...engagementPool]
      .filter((e) => e.end_date != null)
      .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime())
      .slice(0, PANEL_LIMIT),
    [engagementPool, PANEL_LIMIT]
  );

  const upcomingReports = React.useMemo(() =>
    [...reportPool]
      .filter((r) => r.end_date != null)
      .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime())
      .slice(0, PANEL_LIMIT),
    [reportPool, PANEL_LIMIT]
  );

  // Quick access — last 5, sorted by updated_at desc
  const recentEngagements = [...engagementPool]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  const recentReports = [...inProgressReports]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  // Lookups
  const clientMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    clients?.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [clients]);

  const engagementMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    engagements?.forEach((e) => (m[e.id] = e.title));
    return m;
  }, [engagements]);

  const allSummaryLoading = loadingClients && loadingEngagements && loadingReports;

  // Roster panel data — admin gets all engagements; lead gets only ones they lead
  const rosterEngagements = isAdmin ? (engagements ?? []) : myLedEngagements;
  const rosterLoading     = isAdmin ? (loadingEngagements || loadingUsers) : (loadingEngagements || loadingUsers);
  const rosterLabel       = isAdmin ? "Engagement Team Overview" : "My Engagement Team";

  return (
    <PageWrapper title="Dashboard">

      {/* ── Summary cards ── */}
      {allSummaryLoading ? (
        <div style={{ marginBottom: 32 }}>
          <SkeletonCard count={isAdmin || (!isAdmin && !isLead && !isConsultant) ? 4 : 3} />
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <SummaryCard
            label={(isLead || isConsultant) ? "My Clients" : "Clients"}
            count={clientsCount}
            isLoading={loadingClients || (isLead || isConsultant ? loadingEngagements : false)}
            icon={<BuildingIcon />}
            borderColor="var(--color-primary)"
          />
          <SummaryCard
            label={(isLead || isConsultant) ? "My Active Engagements" : "Active Engagements"}
            count={activeEngagementsCount}
            isLoading={loadingEngagements}
            icon={<ClipboardIcon />}
            borderColor="var(--color-success, #16a34a)"
          />
          <SummaryCard
            label={(isLead || isConsultant) ? "My Reports In Progress" : "Reports In Progress"}
            count={inProgressReports.length}
            isLoading={loadingReports}
            icon={<DocumentIcon />}
            borderColor="var(--color-warning, #d97706)"
          />
          {/* Library Findings — admin and view_only only */}
          {!isLead && !isConsultant && (
            <SummaryCard
              label="Library Findings"
              count={library?.length}
              isLoading={loadingLibrary}
              icon={<BookIcon />}
              borderColor="var(--color-primary)"
            />
          )}
        </div>
      )}

      {/* ── Notice panels ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <NoticePanel
          label="Engagement Notices"
          isLoading={loadingEngagements}
          items={overdueEngagements}
          renderItem={(item, idx, total) =>
            EngagementNoticeRow(item as Engagement, idx, total, today, clientMap, navigate)
          }
        />
        <NoticePanel
          label="Report Notices"
          isLoading={loadingReports}
          items={overdueReports}
          renderItem={(item, idx, total) =>
            ReportNoticeRow(item as Report, idx, total, today, engagementMap, navigate)
          }
        />
      </div>

      {/* ── Upcoming panels ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <UpcomingPanel
          label="Upcoming Engagements"
          isLoading={loadingEngagements}
          items={upcomingEngagements}
          renderItem={(item, idx, total) =>
            EngagementUpcomingRow(item as Engagement, idx, total, today, clientMap, navigate)
          }
        />
        <UpcomingPanel
          label="Upcoming Reports"
          isLoading={loadingReports}
          items={upcomingReports}
          renderItem={(item, idx, total) =>
            ReportUpcomingRow(item as Report, idx, total, today, engagementMap, navigate)
          }
        />
      </div>

      {/* ── Quick access ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Recent Engagements */}
        <div>
          <p style={sectionLabelStyle}>
            {(isLead || isConsultant) ? "My Recent Engagements" : "Recent Engagements"}
          </p>
          <div style={panelStyle}>
            {loadingEngagements ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <Spinner size={24} />
              </div>
            ) : errorEngagements ? (
              <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 13, color: "var(--color-danger)" }}>
                Failed to load engagements.
              </div>
            ) : recentEngagements.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--color-gray-400)", margin: "0 0 8px" }}>
                  {(isLead || isConsultant)
                    ? "You are not assigned to any engagements yet."
                    : `No engagements yet. ${canCreateEngagement ? "Create your first engagement to get started." : ""}`}
                </p>
                {!isLead && !isConsultant && canCreateEngagement && (
                  <button
                    onClick={() => navigate("/engagements")}
                    style={{ fontSize: 13, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}
                  >
                    + New Engagement
                  </button>
                )}
              </div>
            ) : (
              recentEngagements.map((e, idx) =>
                EngagementRecentRow(e, idx, recentEngagements.length, clientMap, navigate)
              )
            )}
          </div>
        </div>

        {/* Reports In Progress */}
        <div>
          <p style={sectionLabelStyle}>
            {(isLead || isConsultant) ? "My Reports In Progress" : "Reports In Progress"}
          </p>
          <div style={panelStyle}>
            {loadingReports ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <Spinner size={24} />
              </div>
            ) : errorReports ? (
              <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 13, color: "var(--color-danger)" }}>
                Failed to load reports.
              </div>
            ) : recentReports.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--color-gray-400)", margin: 0 }}>
                  {(isLead || isConsultant)
                    ? "No reports in progress for your engagements."
                    : "No reports in progress."}
                </p>
              </div>
            ) : (
              recentReports.map((r, idx) =>
                ReportRecentRow(r, idx, recentReports.length, engagementMap, navigate)
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Engagement Roster panel — admin + lead only ── */}
      {(isAdmin || isLead) && (
        <EngagementRosterPanel
          label={rosterLabel}
          isLoading={rosterLoading}
          engagements={rosterEngagements}
          clientMap={clientMap}
          userMap={userMap}
          navigate={navigate}
        />
      )}
    </PageWrapper>
  );
}
