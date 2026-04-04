import React from "react";
import { Button } from "../../../components/ui/Button";
import { LibrarySelectModal } from "../../../components/report/LibrarySelectModal";
import { useToast } from "../../../components/ui/useToast";
import { useReportBuilderStore } from "../../../store/reportBuilderStore";
import { SeveritySection } from "./SeveritySection";
import type { Finding, ReportSection } from "../../../types/models";

interface FindingsSectionProps {
  reportId: string;
  sections: ReportSection[];
  findingsBySection: Record<string, Finding[]>;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onRefetch: () => void;
}

const SEVERITY_SECTION_TYPES = [
  "critical_findings",
  "high_findings",
  "medium_findings",
  "low_findings",
  "informational",
] as const;

export function FindingsSection({
  reportId,
  sections,
  findingsBySection,
  canAdd,
  canEdit,
  canDelete,
  onRefetch,
}: FindingsSectionProps) {
  const toast = useToast();
  const { addFindings } = useReportBuilderStore();

  const [libraryModalOpen, setLibraryModalOpen] = React.useState(false);
  const [targetSection, setTargetSection] = React.useState<ReportSection | undefined>(undefined);

  const openLibraryModal = (section?: ReportSection) => {
    setTargetSection(section);
    setLibraryModalOpen(true);
  };

  // Get only severity sections, in order
  const severitySections = sections.filter((s) =>
    SEVERITY_SECTION_TYPES.includes(s.section_type as typeof SEVERITY_SECTION_TYPES[number])
  );

  const handleFindingsAdded = (newFindings: Finding[]) => {
    // Group by section and add to store
    const bySectionId: Record<string, Finding[]> = {};
    for (const f of newFindings) {
      if (!bySectionId[f.section_id]) bySectionId[f.section_id] = [];
      bySectionId[f.section_id].push(f);
    }
    for (const [sectionId, findings] of Object.entries(bySectionId)) {
      addFindings(sectionId, findings);
    }
    setLibraryModalOpen(false);
    toast.success(`Added ${newFindings.length} ${newFindings.length === 1 ? "finding" : "findings"}`);
  };

  return (
    <>
      <div
        style={{
          background: "var(--color-white)",
          border: "1px solid var(--color-gray-200)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--color-gray-900)", margin: 0 }}>
            Findings
          </h3>
          {canAdd && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => openLibraryModal(undefined)}
            >
              + Add Findings from Library
            </Button>
          )}
        </div>

        {/* Severity sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {severitySections.map((section) => (
            <div key={section.id} id={`rb-sev-${section.severity_filter ?? section.section_type}`}>
              <SeveritySection
                section={section}
                findings={findingsBySection[section.id] ?? []}
                onRefetch={onRefetch}
                readOnly={!canEdit && !canDelete}
                canAdd={canAdd}
                onAdd={() => openLibraryModal(section)}
              />
            </div>
          ))}
          {severitySections.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--color-gray-400)", textAlign: "center", padding: "24px 0" }}>
              No severity sections found.
            </p>
          )}
        </div>
      </div>

      {/* Library Select Modal — targetSection set when opened from a section's empty state */}
      <LibrarySelectModal
        isOpen={libraryModalOpen}
        onClose={() => { setLibraryModalOpen(false); setTargetSection(undefined); }}
        reportId={reportId}
        targetSection={targetSection}
        onFindingsAdded={handleFindingsAdded}
      />
    </>
  );
}
