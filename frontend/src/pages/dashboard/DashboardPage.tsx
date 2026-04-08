import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { SkeletonCard } from "../../components/loading/SkeletonCard";
import { usePermission } from "../../hooks/usePermission";
import { getClients } from "../../api/clients";
import { getEngagements } from "../../api/engagements";
import { getReports } from "../../api/reports";
import { getLibraryFindings } from "../../api/library";
import { formatRelativeTime } from "../../utils/formatting";
import type { BadgeVariant } from "../../components/ui/Badge";

const STALE = 120_000; // 2 minutes

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

// ── Summary card ───────────────────────────────────────────────────────────

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

// ── SVG icons ──────────────────────────────────────────────────────────────

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

// ── Dashboard ──────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const canCreateEngagement = usePermission("engagement", "create");

  // All data fetches in parallel
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
  });

  // Today at midnight for consistent date comparisons
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Derived counts
  const activeEngagements = engagements?.filter(
    (e) => e.status === "active" || e.status === "in_review"
  );
  const inProgressReports = reports?.filter(
    (r) => r.status === "draft" || r.status === "review" || r.status === "editing"
  );

  // Notice panels — past end_date, no completed_date
  const overdueEngagements = React.useMemo(() =>
    engagements
      ? engagements
          .filter((e) => e.end_date && !e.completed_date && new Date(e.end_date) < today)
          .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime())
      : [],
    [engagements, today]
  );

  const overdueReports = React.useMemo(() =>
    reports
      ? reports
          .filter((r) => r.end_date && !r.completed_date && new Date(r.end_date) < today)
          .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime())
      : [],
    [reports, today]
  );

  // Due date panels — top 10 with end_date set, sorted soonest first
  const upcomingEngagements = React.useMemo(() =>
    engagements
      ? [...engagements]
          .filter((e) => e.end_date != null)
          .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime())
          .slice(0, 10)
      : [],
    [engagements]
  );

  const upcomingReports = React.useMemo(() =>
    reports
      ? [...reports]
          .filter((r) => r.end_date != null)
          .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime())
          .slice(0, 10)
      : [],
    [reports]
  );

  // Quick access lists (last 5, sorted by updated_at desc)
  const recentEngagements = engagements
    ? [...engagements]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5)
    : [];

  const recentReports = inProgressReports
    ? [...inProgressReports]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5)
    : [];

  // Client name lookup
  const clientMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    clients?.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [clients]);

  // Engagement name lookup (for reports)
  const engagementMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    engagements?.forEach((e) => (m[e.id] = e.title));
    return m;
  }, [engagements]);

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--color-gray-500)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 10,
  };

  const panelStyle: React.CSSProperties = {
    background: "var(--color-white)",
    border: "1px solid var(--color-gray-200)",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
  };

  const allSummaryLoading = loadingClients && loadingEngagements && loadingReports && loadingLibrary;

  return (
    <PageWrapper title="Dashboard">
      {/* ── Summary cards ── */}
      {allSummaryLoading ? (
        <div style={{ marginBottom: 32 }}>
          <SkeletonCard count={4} />
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
            label="Clients"
            count={clients?.length}
            isLoading={loadingClients}
            icon={<BuildingIcon />}
            borderColor="var(--color-primary)"
          />
          <SummaryCard
            label="Active Engagements"
            count={activeEngagements?.length}
            isLoading={loadingEngagements}
            icon={<ClipboardIcon />}
            borderColor="var(--color-success, #16a34a)"
          />
          <SummaryCard
            label="Reports In Progress"
            count={inProgressReports?.length}
            isLoading={loadingReports}
            icon={<DocumentIcon />}
            borderColor="var(--color-warning, #d97706)"
          />
          <SummaryCard
            label="Library Findings"
            count={library?.length}
            isLoading={loadingLibrary}
            icon={<BookIcon />}
            borderColor="var(--color-primary)"
          />
        </div>
      )}

      {/* ── Notice panels ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

        {/* Engagement Notices */}
        <div>
          <p style={sectionLabelStyle}>Engagement Notices</p>
          <div style={{ ...panelStyle, borderLeft: "4px solid #d97706" }}>
            {loadingEngagements ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Spinner size={20} />
              </div>
            ) : overdueEngagements.length === 0 ? (
              <div style={{ padding: "16px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#16a34a" }}>✓</span>
                <span style={{ fontSize: 13, color: "var(--color-gray-500)" }}>All engagements up to date.</span>
              </div>
            ) : (
              overdueEngagements.map((e, idx) => (
                <div
                  key={e.id}
                  onClick={() => navigate(`/engagements?expand=${e.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 14px",
                    borderBottom: idx < overdueEngagements.length - 1 ? "1px solid var(--color-gray-100)" : "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(el) => (el.currentTarget.style.background = "var(--color-gray-50)")}
                  onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                      {e.title}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
                      {clientMap[e.client_id] ?? "—"}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#dc2626",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: 4,
                      padding: "2px 6px",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {daysOverdue(today, e.end_date!)}d overdue
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Report Notices */}
        <div>
          <p style={sectionLabelStyle}>Report Notices</p>
          <div style={{ ...panelStyle, borderLeft: "4px solid #d97706" }}>
            {loadingReports ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Spinner size={20} />
              </div>
            ) : overdueReports.length === 0 ? (
              <div style={{ padding: "16px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#16a34a" }}>✓</span>
                <span style={{ fontSize: 13, color: "var(--color-gray-500)" }}>All reports up to date.</span>
              </div>
            ) : (
              overdueReports.map((r, idx) => (
                <div
                  key={r.id}
                  onClick={() => navigate(`/reports/${r.id}/build`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 14px",
                    borderBottom: idx < overdueReports.length - 1 ? "1px solid var(--color-gray-100)" : "none",
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
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#dc2626",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: 4,
                      padding: "2px 6px",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {daysOverdue(today, r.end_date!)}d overdue
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Due date panels ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

        {/* Upcoming Engagements */}
        <div>
          <p style={sectionLabelStyle}>Upcoming Engagements</p>
          <div style={panelStyle}>
            {loadingEngagements ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Spinner size={20} />
              </div>
            ) : upcomingEngagements.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--color-gray-400)", margin: 0 }}>
                  No engagements with a due date.
                </p>
              </div>
            ) : (
              upcomingEngagements.map((e, idx) => (
                <div
                  key={e.id}
                  onClick={() => navigate(`/engagements?expand=${e.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 14px",
                    borderBottom: idx < upcomingEngagements.length - 1 ? "1px solid var(--color-gray-100)" : "none",
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
                    <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
                      {clientMap[e.client_id] ?? "—"}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: endDateColor(today, e.end_date!),
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(e.end_date!)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Reports */}
        <div>
          <p style={sectionLabelStyle}>Upcoming Reports</p>
          <div style={panelStyle}>
            {loadingReports ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Spinner size={20} />
              </div>
            ) : upcomingReports.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--color-gray-400)", margin: 0 }}>
                  No reports with a due date.
                </p>
              </div>
            ) : (
              upcomingReports.map((r, idx) => (
                <div
                  key={r.id}
                  onClick={() => navigate(`/reports/${r.id}/build`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 14px",
                    borderBottom: idx < upcomingReports.length - 1 ? "1px solid var(--color-gray-100)" : "none",
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
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: endDateColor(today, r.end_date!),
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(r.end_date!)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Quick access ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Recent Engagements */}
        <div>
          <p style={sectionLabelStyle}>Recent Engagements</p>
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
                  No engagements yet.{" "}
                  {canCreateEngagement && "Create your first engagement to get started."}
                </p>
                {canCreateEngagement && (
                  <button
                    onClick={() => navigate("/engagements")}
                    style={{ fontSize: 13, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}
                  >
                    + New Engagement
                  </button>
                )}
              </div>
            ) : (
              recentEngagements.map((e, idx) => (
                <div
                  key={e.id}
                  onClick={() => navigate(`/engagements?expand=${e.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 14px",
                    borderBottom: idx < recentEngagements.length - 1 ? "1px solid var(--color-gray-100)" : "none",
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
                    <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
                      {clientMap[e.client_id] ?? "—"}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--color-gray-400)", flexShrink: 0 }}>
                    {formatRelativeTime(e.updated_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Reports In Progress */}
        <div>
          <p style={sectionLabelStyle}>Reports In Progress</p>
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
                  No reports in progress.
                </p>
              </div>
            ) : (
              recentReports.map((r, idx) => (
                <div
                  key={r.id}
                  onClick={() => navigate(`/reports/${r.id}/build`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 14px",
                    borderBottom: idx < recentReports.length - 1 ? "1px solid var(--color-gray-100)" : "none",
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
              ))
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
