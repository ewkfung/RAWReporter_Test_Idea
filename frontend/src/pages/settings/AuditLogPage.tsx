import React from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Input } from "../../components/ui/Input";
import { SkeletonTable } from "../../components/loading/SkeletonTable";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import { usePermission } from "../../hooks/usePermission";
import { listAuditLogs } from "../../api/auditLog";
import { listUsers } from "../../api/users";
import type { AuditAction, AuditLog } from "../../types/models";

// ── Category filter ────────────────────────────────────────────────────────

type CategoryKey = "all" | "login" | "access" | "archive_restore" | "delete" | "user_management";

const CATEGORIES: Array<{ key: CategoryKey; label: string; actions: AuditAction[] | null }> = [
  { key: "all", label: "All", actions: null },
  { key: "login", label: "Login", actions: ["user_login"] },
  {
    key: "access",
    label: "Access",
    actions: ["client_viewed", "engagement_viewed", "report_viewed"],
  },
  {
    key: "archive_restore",
    label: "Archive / Restore",
    actions: [
      "client_archived", "client_restored",
      "engagement_archived", "engagement_restored",
      "report_archived", "report_restored",
      "library_finding_archived", "library_finding_restored",
    ],
  },
  {
    key: "delete",
    label: "Delete",
    actions: [
      "client_deleted", "engagement_deleted", "report_deleted",
      "library_finding_deleted", "finding_deleted", "evidence_deleted",
    ],
  },
  {
    key: "user_management",
    label: "User Management",
    actions: [
      "user_created", "user_deactivated", "user_deleted",
      "user_role_assigned", "user_password_changed",
    ],
  },
];

// ── Action label formatter ─────────────────────────────────────────────────

function formatAction(action: AuditAction): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Action badge color ─────────────────────────────────────────────────────

function actionColor(action: AuditAction): string {
  if (action === "user_login") return "var(--color-primary)";
  if (action.endsWith("_deleted")) return "var(--color-danger)";
  if (action.endsWith("_archived")) return "var(--color-warning)";
  if (action.endsWith("_restored")) return "#059669"; // green
  if (action.endsWith("_viewed")) return "var(--color-gray-400)";
  return "var(--color-gray-600)";
}

// ── Page size ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

// ── Time range presets ─────────────────────────────────────────────────────

type PresetKey = "custom" | "24h" | "5d" | "7d" | "14d" | "30d" | "90d" | "1y";

const PRESETS: Array<{ key: PresetKey; label: string; days: number | null }> = [
  { key: "custom", label: "Custom range", days: null },
  { key: "24h",   label: "Last 24 hours", days: 1 },
  { key: "5d",    label: "Last 5 days",   days: 5 },
  { key: "7d",    label: "Last week",     days: 7 },
  { key: "14d",   label: "Last 2 weeks",  days: 14 },
  { key: "30d",   label: "Last 30 days",  days: 30 },
  { key: "90d",   label: "Last 90 days",  days: 90 },
  { key: "1y",    label: "Last year",     days: 365 },
];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

// ── Component ──────────────────────────────────────────────────────────────

export function AuditLogPage() {
  const canViewAuditLog = usePermission("audit_log", "view");

  const [category, setCategory] = React.useState<CategoryKey>("all");
  const [search, setSearch] = React.useState("");
  const [preset, setPreset] = React.useState<PresetKey>("30d");
  const [fromDate, setFromDate] = React.useState(() => daysAgo(30));
  const [toDate, setToDate] = React.useState(() => toDateStr(new Date()));
  const [offset, setOffset] = React.useState(0);
  const [rows, setRows] = React.useState<AuditLog[]>([]);

  // When preset changes (not custom), derive from/to dates
  const handlePresetChange = (key: PresetKey) => {
    setPreset(key);
    const p = PRESETS.find((p) => p.key === key)!;
    if (p.days !== null) {
      setFromDate(daysAgo(p.days));
      setToDate(toDateStr(new Date()));
    }
  };

  // Switch to custom when user manually edits dates
  const handleFromDateChange = (v: string) => {
    setPreset("custom");
    setFromDate(v);
  };

  const handleToDateChange = (v: string) => {
    setPreset("custom");
    setToDate(v);
  };

  // Reset pagination only when server-side filters change (date range).
  // Category and search are client-side — they filter existing rows without refetching.
  React.useEffect(() => {
    setOffset(0);
    setRows([]);
  }, [fromDate, toDate]);

  // toDate is a date string (YYYY-MM-DD). Python parses it as midnight, so we
  // append end-of-day time to include all logs from the selected date.
  const toDateEndOfDay = toDate ? `${toDate}T23:59:59` : undefined;

  const { data: page = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-logs", offset, fromDate, toDate],
    queryFn: () =>
      listAuditLogs({
        limit: PAGE_SIZE,
        offset,
        from_date: fromDate || undefined,
        to_date: toDateEndOfDay,
      }),
    staleTime: 0,
    enabled: canViewAuditLog,
  });

  // Append new page to accumulated rows
  React.useEffect(() => {
    if (offset === 0) {
      setRows(page);
    } else if (page.length > 0) {
      setRows((prev) => [...prev, ...page]);
    }
  }, [page, offset]);

  // Parallel query for username lookup
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    staleTime: 60_000,
    enabled: canViewAuditLog,
  });

  const userMap = React.useMemo(
    () => new Map(users.map((u) => [u.id, u.username])),
    [users]
  );

  if (!canViewAuditLog) return <Navigate to="/" replace />;

  // Apply client-side filters
  const selectedCategory = CATEGORIES.find((c) => c.key === category)!;
  const filtered = rows.filter((row) => {
    if (selectedCategory.actions && !selectedCategory.actions.includes(row.action)) return false;
    if (search && !(row.resource_name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const hasMore = page.length === PAGE_SIZE;

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 500,
    border: "1px solid",
    cursor: "pointer",
    background: active ? "var(--color-primary)" : "transparent",
    borderColor: active ? "var(--color-primary)" : "var(--color-gray-200)",
    color: active ? "var(--color-white)" : "var(--color-gray-600)",
    transition: "all 0.1s",
    whiteSpace: "nowrap" as const,
  });

  return (
    <PageWrapper title="Audit Log">
      {/* Filter bar — row 1: search + date range */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: "1 1 220px", maxWidth: 320 }}>
            <Input
              placeholder="Search resource name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {/* Preset dropdown */}
            <select
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value as PresetKey)}
              style={{
                fontSize: 13,
                border: "1px solid var(--color-gray-200)",
                borderRadius: "var(--radius-sm)",
                padding: "5px 8px",
                color: "var(--color-gray-700)",
                background: "var(--color-white)",
                cursor: "pointer",
              }}
            >
              {PRESETS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            {/* Manual date pickers — always visible for fine-tuning */}
            <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => handleFromDateChange(e.target.value)}
              style={{
                fontSize: 13,
                border: "1px solid var(--color-gray-200)",
                borderRadius: "var(--radius-sm)",
                padding: "5px 8px",
                color: "var(--color-gray-700)",
                background: "var(--color-white)",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => handleToDateChange(e.target.value)}
              style={{
                fontSize: 13,
                border: "1px solid var(--color-gray-200)",
                borderRadius: "var(--radius-sm)",
                padding: "5px 8px",
                color: "var(--color-gray-700)",
                background: "var(--color-white)",
              }}
            />
          </div>
        </div>

        {/* Filter bar — row 2: category pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORIES.map(({ key, label }) => (
            <button
              key={key}
              style={pillStyle(category === key)}
              onClick={() => setCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading && rows.length === 0 ? (
        <SkeletonTable rows={8} />
      ) : isError ? (
        <ErrorState message="Failed to load audit logs." onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No audit log entries match your filters." />
      ) : (
        <>
          <div
            style={{
              background: "var(--color-white)",
              border: "1px solid var(--color-gray-200)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "18% 14% 20% 28% 1fr",
                padding: "8px 16px",
                borderBottom: "1px solid var(--color-gray-200)",
                background: "var(--color-gray-50)",
              }}
            >
              {["Timestamp", "User", "Action", "Resource", "Details"].map((h) => (
                <span
                  key={h}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--color-gray-400)",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {filtered.map((row) => {
              const username = row.user_id
                ? (userMap.get(row.user_id) ?? row.user_id.slice(0, 8) + "…")
                : "System";
              const detailParts: string[] = [];
              if (row.details) {
                Object.entries(row.details).forEach(([k, v]) =>
                  detailParts.push(`${k.replace(/_/g, " ")}: ${String(v)}`)
                );
              }
              if (row.ip_address) detailParts.push(`IP: ${row.ip_address}`);
              const detailsText = detailParts.length > 0 ? detailParts.join(" · ") : null;

              return (
                <div
                  key={row.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "18% 14% 20% 28% 1fr",
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--color-gray-100)",
                    alignItems: "start",
                  }}
                >
                  {/* Timestamp */}
                  <span style={{ fontSize: 12, color: "var(--color-gray-500)", lineHeight: 1.4 }}>
                    {new Date(row.created_at).toLocaleString()}
                  </span>

                  {/* User */}
                  <span style={{ fontSize: 13, color: "var(--color-gray-700)", fontWeight: 500 }}>
                    {username}
                  </span>

                  {/* Action */}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: actionColor(row.action),
                    }}
                  >
                    {formatAction(row.action)}
                  </span>

                  {/* Resource */}
                  <div>
                    <span style={{ fontSize: 13, color: "var(--color-gray-800)", fontWeight: 500 }}>
                      {row.resource_name ?? row.resource_id ?? "—"}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: "var(--color-gray-400)",
                        marginTop: 1,
                        textTransform: "capitalize",
                      }}
                    >
                      {row.resource_type.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Details */}
                  <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>
                    {detailsText ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                disabled={isLoading}
                style={{
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-primary)",
                  background: "transparent",
                  border: "1px solid var(--color-primary)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-primary-light)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </PageWrapper>
  );
}
