import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/useToast";
import { updateReport } from "../../../api/reports";
import type { Finding, Report } from "../../../types/models";

// ── Types ──────────────────────────────────────────────────────────────────

interface ReportActionsPanelProps {
  report: Report;
  findings: Finding[];
  canEditReport: boolean;
}

type ReportStatus = "draft" | "review" | "editing" | "final_review" | "complete";

// ── Constants ──────────────────────────────────────────────────────────────

const BREADCRUMB_HEIGHT = 52;

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
  { value: "complete",     label: "Complete" },
];

const STATUS_COLORS: Record<ReportStatus, { bg: string; text: string; border: string }> = {
  draft:        { bg: "var(--color-gray-100)",    text: "var(--color-gray-600)",    border: "var(--color-gray-300)" },
  review:       { bg: "#dbeafe",                  text: "#1d4ed8",                  border: "#93c5fd" },
  editing:      { bg: "#fef3c7",                  text: "#92400e",                  border: "#fcd34d" },
  final_review: { bg: "#ede9fe",                  text: "#6d28d9",                  border: "#c4b5fd" },
  complete:     { bg: "#d1fae5",                  text: "#065f46",                  border: "#6ee7b7" },
};

// ── Component ──────────────────────────────────────────────────────────────

export function ReportActionsPanel({ report, findings, canEditReport }: ReportActionsPanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [statusOpen, setStatusOpen] = React.useState(false);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const statusRef = React.useRef<HTMLDivElement>(null);

  const currentStatus = report.status as ReportStatus;
  const statusStyle = STATUS_COLORS[currentStatus] ?? STATUS_COLORS.draft;

  // Close dropdown on outside click
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
    if (status !== currentStatus) {
      statusMutation.mutate(status);
    }
  };

  // Generate report blocking check
  const blockingFindings = findings.filter(
    (f) => f.is_placement_override && (!f.override_justification || f.override_justification.trim() === "")
  );
  const isValid = blockingFindings.length === 0;

  return (
    <div
      style={{
        position: "sticky",
        top: BREADCRUMB_HEIGHT + 24,
        width: 192,
        flexShrink: 0,
        alignSelf: "flex-start",
        display: "flex",
        flexDirection: "column",
        gap: 12,
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
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-gray-400)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 8px",
            }}
          >
            Report Type
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {report.types.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-gray-700)",
                }}
              >
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
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-gray-400)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            margin: "0 0 10px",
          }}
        >
          Status
        </p>

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
              textTransform: "capitalize",
              gap: 6,
            }}
          >
            <span>{currentStatus.replace(/_/g, " ")}</span>
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
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-gray-400)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            margin: "0 0 10px",
          }}
        >
          Export
        </p>
        <Button
          variant="primary"
          size="sm"
          style={{ width: "100%" }}
          onClick={() => setGenerateOpen(true)}
        >
          Generate Report
        </Button>
      </div>

      {/* ── Generate modal ── */}
      {generateOpen && (
        <Modal
          isOpen={generateOpen}
          onClose={() => setGenerateOpen(false)}
          title="Report Generation"
          width={520}
          footer={
            <Button variant="secondary" onClick={() => setGenerateOpen(false)}>
              Close
            </Button>
          }
        >
          {isValid ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  background: "var(--color-success-light)",
                  border: "1px solid var(--color-success)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M3 9l4 4 8-8" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p style={{ fontSize: 14, color: "var(--color-gray-700)", margin: 0, lineHeight: 1.5 }}>
                  All findings are valid. Document generation will create a DOCX report in Phase 4.
                </p>
              </div>
              <p style={{ fontSize: 13, color: "var(--color-gray-500)", margin: 0 }}>
                Document generation will be implemented in Phase 4. For now, this button confirms
                that all findings have valid placements and justifications.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  background: "var(--color-danger-light)",
                  border: "1px solid var(--color-danger)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M9 3v7M9 13v1" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="9" cy="9" r="8" stroke="var(--color-danger)" strokeWidth="1.5" />
                </svg>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-danger)", margin: "0 0 6px" }}>
                    Cannot generate report
                  </p>
                  <p style={{ fontSize: 14, color: "var(--color-gray-700)", margin: "0 0 10px", lineHeight: 1.5 }}>
                    Some findings have severity overrides without justification. Please edit these
                    findings and provide a justification before generating.
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {blockingFindings.map((f) => (
                      <li key={f.id} style={{ fontSize: 13, color: "var(--color-danger)", marginBottom: 3 }}>
                        {f.title}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
