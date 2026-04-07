import React from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Spinner } from "../../components/ui/Spinner";
import { usePermission } from "../../hooks/usePermission";
import { getTemplatesForType, upsertTemplate } from "../../api/templates";
import type { TemplateEntry } from "../../api/templates";

// ── Builder tab config ─────────────────────────────────────────────────────

const BUILDER_TABS: Array<{ value: string; label: string }> = [
  { value: "vulnerability_assessment", label: "Vulnerability Assessment" },
  { value: "pentest",                  label: "Penetration Testing" },
  { value: "risk",                     label: "Risk Assessment" },
  { value: "compliance_assessment",    label: "Compliance Assessment" },
  { value: "gap_assessment",           label: "Security Gap Assessment" },
];

// Sections that cannot have editable body text
const NON_EDITABLE_TYPES = new Set(["findings", "critical_findings", "high_findings", "medium_findings", "low_findings", "informational"]);

// ── Per-section save state ─────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ── TemplateSectionRow ─────────────────────────────────────────────────────

function TemplateSectionRow({
  entry,
  engagementType,
}: {
  entry: TemplateEntry;
  engagementType: string;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = React.useState(entry.default_body ?? "");
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReadOnly = NON_EDITABLE_TYPES.has(entry.section_type);

  React.useEffect(
    () => () => { if (debounceRef.current) clearTimeout(debounceRef.current); },
    []
  );

  const save = async (text: string) => {
    setStatus("saving");
    try {
      await upsertTemplate(engagementType, entry.section_type, text || null);
      setStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["templates", engagementType] });
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    const original = (entry.default_body ?? "").trim();
    if (trimmed !== original) save(trimmed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setValue(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(e.target.value.trim()), 600);
  };

  const saveIndicatorColor =
    status === "saved" ? "#16a34a" :
    status === "error" ? "#dc2626" :
    status === "saving" ? "#d97706" : "transparent";

  const saveIndicatorLabel =
    status === "saved" ? "Saved" :
    status === "error" ? "Error" :
    status === "saving" ? "Saving…" : "";

  return (
    <div
      style={{
        border: "1px solid var(--color-gray-200)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        background: isReadOnly ? "var(--color-gray-50)" : "var(--color-white)",
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: isReadOnly ? "none" : "1px solid var(--color-gray-100)",
          background: isReadOnly ? "var(--color-gray-50)" : "var(--color-gray-50)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-700)" }}>
          {entry.title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isReadOnly && (
            <span style={{ fontSize: 11, color: "var(--color-gray-400)", fontStyle: "italic" }}>
              no default text
            </span>
          )}
          {saveIndicatorLabel && (
            <span style={{ fontSize: 12, fontWeight: 500, color: saveIndicatorColor }}>
              {saveIndicatorLabel}
            </span>
          )}
        </div>
      </div>

      {/* Editable body */}
      {!isReadOnly && (
        <div style={{ padding: "0" }}>
          <textarea
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={`Default content for ${entry.title}…`}
            rows={4}
            style={{
              width: "100%",
              padding: "10px 16px",
              fontSize: 14,
              lineHeight: 1.6,
              border: "none",
              outline: "none",
              background: "transparent",
              resize: "vertical",
              fontFamily: "var(--font-sans)",
              color: "var(--color-gray-900)",
              boxSizing: "border-box",
              minHeight: 80,
            }}
            onFocus={(e) => { e.target.style.background = "#fafafa"; }}
            onBlurCapture={(e) => { e.target.style.background = "transparent"; }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function DefaultTemplatesPage() {
  const canEdit = usePermission("report_default_template", "edit");
  const canView = usePermission("report_default_template", "view");
  const [activeTab, setActiveTab] = React.useState(BUILDER_TABS[0].value);

  // All hooks before any early return (CLAUDE.md rule #11)
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["templates", activeTab],
    queryFn: () => getTemplatesForType(activeTab),
    staleTime: 30_000,
    enabled: canView,
  });

  if (!canView) return <Navigate to="/" replace />;

  return (
    <PageWrapper title="Default Report Templates">
      <p style={{ fontSize: 14, color: "var(--color-gray-500)", marginBottom: 24, marginTop: -4 }}>
        Pre-fill section content that auto-populates when a new report is created.
        Leave a field blank to start that section empty.
        {!canEdit && (
          <span style={{ marginLeft: 6, color: "var(--color-gray-400)" }}>
            (read-only — Admin role required to edit)
          </span>
        )}
      </p>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "2px solid var(--color-gray-200)",
          marginBottom: 24,
          overflowX: "auto",
        }}
      >
        {BUILDER_TABS.map((tab) => {
          const isActive = tab.value === activeTab;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--color-primary)" : "var(--color-gray-600)",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid var(--color-primary)" : "2px solid transparent",
                marginBottom: -2,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Section list */}
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Spinner size={24} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {entries.map((entry) => (
            canEdit ? (
              <TemplateSectionRow
                key={`${activeTab}-${entry.section_type}`}
                entry={entry}
                engagementType={activeTab}
              />
            ) : (
              /* Read-only view */
              <div
                key={`${activeTab}-${entry.section_type}`}
                style={{
                  border: "1px solid var(--color-gray-200)",
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                    borderBottom: entry.default_body ? "1px solid var(--color-gray-100)" : "none",
                    background: "var(--color-gray-50)",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-700)" }}>
                    {entry.title}
                  </span>
                </div>
                {entry.default_body && (
                  <div style={{ padding: "10px 16px", fontSize: 14, color: "var(--color-gray-600)", whiteSpace: "pre-wrap" }}>
                    {entry.default_body}
                  </div>
                )}
              </div>
            )
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
