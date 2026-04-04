import React from "react";
import { LibrarySelectModal } from "./LibrarySelectModal";
import { useReportBuilderStore } from "../../store/reportBuilderStore";
import { usePermission } from "../../hooks/usePermission";
import { useToast } from "../ui/useToast";
import type { Finding, ReportSection } from "../../types/models";

interface SectionBlockProps {
  section: ReportSection;
  findings: Finding[];
  reportId: string;
}

const SECTION_LABEL: Record<string, string> = {
  executive_summary: "Executive Summary",
  findings_summary: "Findings Summary",
  crown_jewel: "Crown Jewel",
  critical_findings: "Critical Findings",
  high_findings: "High Findings",
  medium_findings: "Medium Findings",
  low_findings: "Low Findings",
  informational: "Informational",
  closing: "Closing",
  appendix: "Appendix",
};

export function SectionBlock({ section, findings, reportId }: SectionBlockProps) {
  const [selectModalOpen, setSelectModalOpen] = React.useState(false);
  const addFindings = useReportBuilderStore((s) => s.addFindings);
  const canAddFindings = usePermission("finding", "create");
  const toast = useToast();

  const isSeveritySection = section.severity_filter != null;
  const label = section.title ?? SECTION_LABEL[section.section_type] ?? section.section_type;

  const handleFindingsAdded = (newFindings: Finding[]) => {
    addFindings(section.id, newFindings);
    setSelectModalOpen(false);
    toast.success(
      `${newFindings.length} ${newFindings.length === 1 ? "finding" : "findings"} added to ${label}`
    );
  };

  return (
    <>
      <div
        style={{
          background: "var(--color-white)",
          border: "1px solid var(--color-gray-200)",
          borderRadius: "var(--radius-lg)",
          marginBottom: 16,
          overflow: "hidden",
        }}
      >
        {/* Section header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: findings.length > 0 ? "1px solid var(--color-gray-100)" : undefined,
            background: "var(--color-gray-50)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-gray-800)" }}>
            {label}
          </span>
          <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
            {findings.length} {findings.length === 1 ? "finding" : "findings"}
          </span>
        </div>

        {/* Findings list placeholder — expanded in ReportBuilderPage */}
        {findings.length > 0 && (
          <div style={{ padding: "8px 16px" }}>
            {findings.map((f) => (
              <div
                key={f.id}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid var(--color-gray-100)",
                  fontSize: 13,
                  color: "var(--color-gray-800)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontWeight: 600 }}>{f.title}</span>
                {f.is_placement_override && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#92400e",
                      background: "#fffbeb",
                      border: "1px solid #d97706",
                      borderRadius: 999,
                      padding: "1px 7px",
                    }}
                  >
                    Override
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Findings button — severity sections only */}
        {isSeveritySection && canAddFindings && (
          <div style={{ padding: "10px 16px", borderTop: findings.length > 0 ? "1px solid var(--color-gray-100)" : undefined }}>
            <button
              onClick={() => setSelectModalOpen(true)}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-primary)",
                background: "none",
                border: "1px dashed var(--color-primary-200, #bfdbfe)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                padding: "6px 14px",
                width: "100%",
                textAlign: "center",
              }}
            >
              + Add Findings from Library
            </button>
          </div>
        )}
      </div>

      {selectModalOpen && (
        <LibrarySelectModal
          isOpen={selectModalOpen}
          onClose={() => setSelectModalOpen(false)}
          reportId={reportId}
          targetSection={section}
          onFindingsAdded={handleFindingsAdded}
        />
      )}
    </>
  );
}
