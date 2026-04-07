import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../components/ui/Button";
import { UserPickerOverlay, UserChip } from "../../../components/ui/UserPickerOverlay";
import { useToast } from "../../../components/ui/useToast";
import { updateReport } from "../../../api/reports";
import { updateEngagement } from "../../../api/engagements";
import { listUsers } from "../../../api/users";
import { useAuthStore } from "../../../store/authStore";
import { GenerationBlockedModal } from "./GenerationBlockedModal";
import type { Engagement, Finding, Report } from "../../../types/models";

// ── Types ──────────────────────────────────────────────────────────────────

interface ReportActionsPanelProps {
  report: Report;
  findings: Finding[];
  canEditReport: boolean;
  engagement?: Engagement;
}

type ReportStatus = "draft" | "review" | "editing" | "final_review" | "complete";

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  pentest:                  "Pentest",
  gap_assessment:           "Gap Assessment",
  vulnerability_assessment: "Vulnerability Assessment",
  tabletop:                 "Tabletop",
  tsa_directive:            "TSA Directive",
  compliance_assessment:    "Compliance Assessment",
};

const STATUS_OPTIONS: Array<{ value: ReportStatus; label: string }> = [
  { value: "draft",        label: "Draft" },
  { value: "review",       label: "Review" },
  { value: "editing",      label: "Editing" },
  { value: "final_review", label: "Final Review" },
  { value: "complete",     label: "Completed" },
];

const STATUS_COLORS: Record<ReportStatus, { bg: string; text: string; border: string }> = {
  draft:        { bg: "var(--color-gray-100)",    text: "var(--color-gray-600)",    border: "var(--color-gray-300)" },
  review:       { bg: "#dbeafe",                  text: "#1d4ed8",                  border: "#93c5fd" },
  editing:      { bg: "#fef3c7",                  text: "#92400e",                  border: "#fcd34d" },
  final_review: { bg: "#ede9fe",                  text: "#6d28d9",                  border: "#c4b5fd" },
  complete:     { bg: "#d1fae5",                  text: "#065f46",                  border: "#6ee7b7" },
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--color-gray-400)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: "0 0 10px",
};

// ── DateField sub-component ────────────────────────────────────────────────

function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-gray-400)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          fontSize: 12,
          width: "100%",
          padding: "5px 7px",
          border: "1px solid var(--color-gray-200)",
          borderRadius: "var(--radius-sm)",
          color: value ? "var(--color-gray-700)" : "var(--color-gray-400)",
          background: disabled ? "var(--color-gray-50)" : "var(--color-white)",
          cursor: disabled ? "default" : "pointer",
          boxSizing: "border-box",
          outline: "none",
        }}
      />
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function ReportActionsPanel({ report, findings, canEditReport, engagement }: ReportActionsPanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  // Local editable state for lead / consultants — synced from engagement prop
  const [leadId, setLeadId] = React.useState<string | null>(engagement?.engagement_lead_id ?? null);
  const [consultantIds, setConsultantIds] = React.useState<string[]>(engagement?.consultant_ids ?? []);
  const [leadPickerOpen, setLeadPickerOpen] = React.useState(false);
  const [consultantPickerOpen, setConsultantPickerOpen] = React.useState(false);

  // Sync when engagement prop changes (e.g. after refetch)
  React.useEffect(() => {
    setLeadId(engagement?.engagement_lead_id ?? null);
    setConsultantIds(engagement?.consultant_ids ?? []);
  }, [engagement?.engagement_lead_id, engagement?.consultant_ids]);

  // Fetch all users for picker and name resolution
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    staleTime: 120_000,
    enabled: !!engagement,
  });

  const userMap = React.useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users]
  );

  const displayName = (id: string) => {
    const u = userMap.get(id);
    if (!u) return id.slice(0, 8) + "…";
    return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username;
  };

  // Save engagement lead / consultants immediately on change
  const saveEngagement = React.useCallback(
    (patch: { engagement_lead_id?: string | null; consultant_ids?: string[] }) => {
      if (!engagement) return;
      updateEngagement(engagement.id, patch)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["engagement", engagement.id] });
        })
        .catch(() => toast.error("Failed to save"));
    },
    [engagement, queryClient, toast]
  );

  const handleSetLead = (userId: string) => {
    setLeadId(userId);
    saveEngagement({ engagement_lead_id: userId });
  };

  const handleRemoveLead = () => {
    setLeadId(null);
    saveEngagement({ engagement_lead_id: null });
  };

  const handleAddConsultant = (userId: string) => {
    const next = [...consultantIds, userId];
    setConsultantIds(next);
    saveEngagement({ consultant_ids: next });
  };

  const handleRemoveConsultant = (userId: string) => {
    const next = consultantIds.filter((id) => id !== userId);
    setConsultantIds(next);
    saveEngagement({ consultant_ids: next });
  };

  const token = useAuthStore((s) => s.token);

  const [statusOpen, setStatusOpen] = React.useState(false);
  const statusRef = React.useRef<HTMLDivElement>(null);

  // Generate report state
  const [generating, setGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  const [blockingFindings, setBlockingFindings] = React.useState<
    Array<{ id: string; title: string; section: string }>
  >([]);
  const [showBlockedModal, setShowBlockedModal] = React.useState(false);

  // Local date state — synced from report prop
  const [startDate, setStartDate] = React.useState(report.start_date?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = React.useState(report.end_date?.slice(0, 10) ?? "");
  const [completedDate, setCompletedDate] = React.useState(report.completed_date?.slice(0, 10) ?? "");

  // Sync dates if the report prop updates (e.g. after status mutation)
  React.useEffect(() => {
    setStartDate(report.start_date?.slice(0, 10) ?? "");
    setEndDate(report.end_date?.slice(0, 10) ?? "");
    setCompletedDate(report.completed_date?.slice(0, 10) ?? "");
  }, [report.start_date, report.end_date, report.completed_date]);

  const currentStatus = report.status as ReportStatus;
  const statusStyle = STATUS_COLORS[currentStatus] ?? STATUS_COLORS.draft;

  // Status label — "complete" displays as "Completed"
  const currentLabel = STATUS_OPTIONS.find((o) => o.value === currentStatus)?.label
    ?? currentStatus.replace(/_/g, " ");

  // Close status dropdown on outside click
  React.useEffect(() => {
    if (!statusOpen) return;
    const handler = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [statusOpen]);

  // ── Mutations ──────────────────────────────────────────────────────────

  const reportMutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateReport>[1]) => updateReport(report.id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", report.id] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: () => {
      toast.error("Failed to save");
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: ReportStatus) => updateReport(report.id, { status }),
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: ["report", report.id] });
      const previous = queryClient.getQueryData<Report>(["report", report.id]);
      queryClient.setQueryData<Report>(["report", report.id], (old) =>
        old ? { ...old, status: newStatus } : old
      );
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", report.id] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Status updated");
    },
    onError: (_err, _status, context) => {
      if (context?.previous) {
        queryClient.setQueryData<Report>(["report", report.id], context.previous);
      }
      toast.error("Failed to update status");
    },
  });

  const handleStatusSelect = (status: ReportStatus) => {
    setStatusOpen(false);
    if (status === currentStatus) return;
    statusMutation.mutate(status);
    // Auto-fill completed_date when marking complete
    if (status === "complete" && !report.completed_date) {
      const today = new Date().toISOString().slice(0, 10);
      setCompletedDate(today);
      reportMutation.mutate({ completed_date: today });
    }
  };

  const handleDateChange = (field: "start_date" | "end_date" | "completed_date") => (value: string) => {
    if (field === "start_date") setStartDate(value);
    else if (field === "end_date") setEndDate(value);
    else setCompletedDate(value);
    reportMutation.mutate({ [field]: value || null });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);

    try {
      const response = await fetch(`/api/v1/reports/${report.id}/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let errorData: any = {};
        try { errorData = await response.json(); } catch {}

        // 422 with blocking_findings — placement override without justification
        if (response.status === 422 && errorData.blocking_findings) {
          setBlockingFindings(errorData.blocking_findings);
          setShowBlockedModal(true);
          return;
        }

        // 422 with upload_path — no template uploaded
        if (response.status === 422 && errorData.upload_path) {
          setGenerateError(
            "No document template has been uploaded for this report type. " +
            "An Admin must upload a template at Settings \u2192 Document Templates " +
            "before reports can be generated."
          );
          return;
        }

        // Detail may be nested (dict) or a plain string
        const detail = typeof errorData.detail === "string"
          ? errorData.detail
          : errorData.detail?.detail ?? "Document generation failed. Please try again.";
        setGenerateError(detail);
        return;
      }

      // Success — trigger DOCX download
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : "report.docx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Report downloaded successfully.");
    } catch {
      setGenerateError("Network error. Please check your connection.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      style={{
        width: 192,
        flexShrink: 0,
        alignSelf: "flex-start",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        paddingBottom: 32,
      }}
    >
      {/* ── Report type card ── */}
      {report.types && report.types.length > 0 && (
        <div
          style={{
            background: "var(--color-white)",
            border: "1px solid var(--color-gray-200)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 16px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p style={SECTION_LABEL}>Report Type</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {report.types.map((t) => (
              <span key={t} style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)" }}>
                {TYPE_LABELS[t] ?? t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Status card ── */}
      <div
        style={{
          background: "var(--color-white)",
          border: "1px solid var(--color-gray-200)",
          borderRadius: "var(--radius-lg)",
          padding: "14px 16px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <p style={SECTION_LABEL}>Status</p>

        <div ref={statusRef} style={{ position: "relative" }}>
          <button
            onClick={() => canEditReport && setStatusOpen((v) => !v)}
            disabled={statusMutation.isPending}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "6px 10px",
              background: statusStyle.bg,
              border: `1px solid ${statusStyle.border}`,
              borderRadius: "var(--radius-sm)",
              cursor: canEditReport ? "pointer" : "default",
              fontSize: 13,
              fontWeight: 600,
              color: statusStyle.text,
              gap: 6,
            }}
          >
            <span>{currentLabel}</span>
            {canEditReport && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                style={{
                  flexShrink: 0,
                  transform: statusOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s",
                  opacity: 0.7,
                }}
              >
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {statusOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                background: "var(--color-white)",
                border: "1px solid var(--color-gray-200)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-md)",
                zIndex: 300,
                overflow: "hidden",
              }}
            >
              {STATUS_OPTIONS.map(({ value, label }) => {
                const s = STATUS_COLORS[value];
                const isSelected = value === currentStatus;
                return (
                  <button
                    key={value}
                    onClick={() => handleStatusSelect(value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "8px 12px",
                      background: isSelected ? "var(--color-gray-50)" : "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 13,
                      fontWeight: isSelected ? 600 : 400,
                      color: "var(--color-gray-700)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "var(--color-gray-50)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "none";
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: s.text,
                        flexShrink: 0,
                      }}
                    />
                    {label}
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: "auto" }}>
                        <path d="M2 6l3 3 5-5" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Lead card ── */}
      {engagement && (
        <div
          style={{
            background: "var(--color-white)",
            border: "1px solid var(--color-gray-200)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 16px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p style={SECTION_LABEL}>Lead</p>
          {leadId ? (
            <UserChip
              label={displayName(leadId)}
              onRemove={canEditReport ? handleRemoveLead : undefined}
            />
          ) : canEditReport ? (
            <button
              type="button"
              onClick={() => setLeadPickerOpen(true)}
              style={{
                fontSize: 12,
                padding: "5px 10px",
                border: "1px dashed var(--color-gray-300)",
                borderRadius: "var(--radius-sm)",
                background: "none",
                cursor: "pointer",
                color: "var(--color-primary)",
                fontWeight: 500,
                width: "100%",
                textAlign: "left",
              }}
            >
              + Select Lead
            </button>
          ) : (
            <span style={{ fontSize: 13, color: "var(--color-gray-400)", fontStyle: "italic" }}>
              Unassigned
            </span>
          )}
        </div>
      )}

      {/* ── Users card ── */}
      {engagement && (
        <div
          style={{
            background: "var(--color-white)",
            border: "1px solid var(--color-gray-200)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 16px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p style={SECTION_LABEL}>Users</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {consultantIds.map((id) => (
              <UserChip
                key={id}
                label={displayName(id)}
                onRemove={canEditReport ? () => handleRemoveConsultant(id) : undefined}
              />
            ))}
          </div>
          {canEditReport && (
            <button
              type="button"
              onClick={() => setConsultantPickerOpen(true)}
              style={{
                fontSize: 12,
                padding: "5px 10px",
                border: "1px dashed var(--color-gray-300)",
                borderRadius: "var(--radius-sm)",
                background: "none",
                cursor: "pointer",
                color: "var(--color-primary)",
                fontWeight: 500,
                width: "100%",
                textAlign: "left",
                marginTop: consultantIds.length > 0 ? 6 : 0,
              }}
            >
              + Add User
            </button>
          )}
          {!canEditReport && consultantIds.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--color-gray-400)", fontStyle: "italic" }}>
              None assigned
            </span>
          )}
        </div>
      )}

      {/* ── Dates card ── */}
      <div
        style={{
          background: "var(--color-white)",
          border: "1px solid var(--color-gray-200)",
          borderRadius: "var(--radius-lg)",
          padding: "14px 16px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <p style={SECTION_LABEL}>Dates</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <DateField
            label="Start Date"
            value={startDate}
            onChange={handleDateChange("start_date")}
            disabled={!canEditReport}
          />
          <DateField
            label="End Date"
            value={endDate}
            onChange={handleDateChange("end_date")}
            disabled={!canEditReport}
          />
          <DateField
            label="Completed Date"
            value={completedDate}
            onChange={handleDateChange("completed_date")}
            disabled={!canEditReport}
          />
        </div>
      </div>

      {/* ── Generate Report card ── */}
      <div
        style={{
          background: "var(--color-white)",
          border: "1px solid var(--color-gray-200)",
          borderRadius: "var(--radius-lg)",
          padding: "14px 16px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <p style={SECTION_LABEL}>Export</p>
        <Button
          variant="primary"
          size="sm"
          style={{ width: "100%" }}
          loading={generating}
          onClick={handleGenerate}
        >
          {generating ? "Generating..." : "Generate Report"}
        </Button>
        {generateError && (
          <p
            style={{
              fontSize: 12,
              color: "var(--color-danger)",
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            {generateError}
          </p>
        )}
      </div>

      {/* ── Lead / consultant pickers ── */}
      <UserPickerOverlay
        isOpen={leadPickerOpen}
        title="Select Lead"
        excludeIds={leadId ? [leadId] : []}
        users={users}
        isLoading={usersLoading}
        onSelect={(u) => handleSetLead(u.id)}
        onClose={() => setLeadPickerOpen(false)}
      />
      <UserPickerOverlay
        isOpen={consultantPickerOpen}
        title="Add User"
        excludeIds={consultantIds}
        users={users}
        isLoading={usersLoading}
        onSelect={(u) => handleAddConsultant(u.id)}
        onClose={() => setConsultantPickerOpen(false)}
      />

      {/* ── Generation blocked modal ── */}
      <GenerationBlockedModal
        isOpen={showBlockedModal}
        onClose={() => setShowBlockedModal(false)}
        blockingFindings={blockingFindings}
      />
    </div>
  );
}
