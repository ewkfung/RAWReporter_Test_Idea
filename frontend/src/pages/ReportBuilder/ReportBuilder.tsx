import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageLoader } from "../../components/loading/PageLoader";
import { ErrorState } from "../../components/ui/ErrorState";
import { getReport } from "../../api/reports";
import { getFindingsBySection } from "../../api/findings";
import { usePermissions } from "../../hooks/usePermission";
import { useReportBuilderStore } from "../../store/reportBuilderStore";
import { ReportTitleBox } from "./components/ReportTitleBox";
import { SectionTextBox } from "./components/SectionTextBox";
import { FindingsOverviewChart } from "./components/FindingsOverviewChart";
import { FindingsSection } from "./components/FindingsSection";
import { ReportActionsPanel } from "./components/ReportActionsPanel";
import { TableOfContents } from "./components/TableOfContents";
import type { Finding, ReportSection } from "../../types/models";

// ── Helpers ────────────────────────────────────────────────────────────────

const TEXT_SECTION_LABELS: Record<string, string> = {
  executive_summary: "Executive Summary",
  findings_summary: "Findings Review",
  crown_jewel: "Crown Jewel Analysis",
  closing: "Conclusion",
};

// ── Component ──────────────────────────────────────────────────────────────

export function ReportBuilder() {
  const { reportId } = useParams<{ reportId: string }>();
  const queryClient = useQueryClient();
  const { setReport, sections, findingsBySection, reset } = useReportBuilderStore();

  // All hooks before any conditional returns (CLAUDE.md rule #11)
  const perms = usePermissions([
    { resource: "report",  action: "edit" },
    { resource: "finding", action: "create" },
    { resource: "finding", action: "edit" },
    { resource: "finding", action: "delete" },
  ]);

  const canEditReport    = perms["report:edit"];
  const canAddFindings   = perms["finding:create"];
  const canEditFinding   = perms["finding:edit"];
  const canDeleteFinding = perms["finding:delete"];

  const {
    data: report,
    isLoading: reportLoading,
    isError: reportError,
  } = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport(reportId!),
    enabled: !!reportId,
    staleTime: 30_000,
  });

  const {
    data: sectionData,
    isLoading: sectionsLoading,
    isError: sectionsError,
    refetch: refetchSections,
  } = useQuery({
    queryKey: ["report-sections-with-findings", reportId],
    queryFn: () => getFindingsBySection(reportId!),
    enabled: !!reportId,
    staleTime: 0,
  });

  React.useEffect(() => {
    if (!sectionData || !reportId) return;
    const secs: ReportSection[] = sectionData.map((d) => d.section);
    const fbs: Record<string, Finding[]> = {};
    for (const d of sectionData) {
      fbs[d.section.id] = d.findings;
    }
    setReport(reportId, secs, fbs);
  }, [sectionData, reportId, setReport]);

  React.useEffect(() => () => reset(), [reset]);

  const isLoading = reportLoading || sectionsLoading;
  const isError   = reportError || sectionsError;

  if (isLoading) {
    return <PageLoader />;
  }

  if (isError || !report) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <ErrorState
          message="Failed to load report. Please try again."
          onRetry={() => { void refetchSections(); }}
        />
        <Link to="/reports" style={{ fontSize: 13, color: "var(--color-primary)", marginTop: 8 }}>
          ← Back to Reports
        </Link>
      </div>
    );
  }

  const allFindings: Finding[] = Object.values(findingsBySection).flat();

  const execSection    = sections.find((s) => s.section_type === "executive_summary");
  const summarySection = sections.find((s) => s.section_type === "findings_summary");
  const crownSection   = sections.find((s) => s.section_type === "crown_jewel");
  const closingSection = sections.find((s) => s.section_type === "closing");

  const handleRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ["report-sections-with-findings", reportId] });
    refetchSections();
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-gray-50)" }}>

      {/* Sticky breadcrumb */}
      <div
        style={{
          background: "var(--color-white)",
          borderBottom: "1px solid var(--color-gray-200)",
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Link
          to="/reports"
          style={{ fontSize: 13, color: "var(--color-gray-500)", display: "flex", alignItems: "center", gap: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Reports
        </Link>
        <span style={{ fontSize: 13, color: "var(--color-gray-300)" }}>/</span>
        <span style={{ fontSize: 13, color: "var(--color-gray-700)", fontWeight: 500 }}>
          Report Builder
        </span>
      </div>

      {/* Two-column layout: TOC (left) + content (right) */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "32px 24px 0",
          display: "flex",
          gap: 28,
          alignItems: "flex-start",
        }}
      >
        {/* ── Table of Contents ── */}
        <TableOfContents findingsBySection={findingsBySection} />


        {/* ── Main content ── */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            paddingBottom: 32,
          }}
        >
          {/* Report Title */}
          <div id="rb-title">
            <ReportTitleBox
              reportId={report.id}
              initialTitle={report.title}
              readOnly={!canEditReport}
            />
          </div>

          {/* Executive Summary */}
          {execSection && (
            <div id="rb-exec-summary">
              <SectionTextBox
                sectionId={execSection.id}
                sectionType={execSection.section_type}
                title={TEXT_SECTION_LABELS["executive_summary"]}
                initialBodyText={execSection.body_text ?? ""}
                readOnly={!canEditReport}
              />
            </div>
          )}

          {/* Findings Review */}
          {summarySection && (
            <div id="rb-findings-review">
              <SectionTextBox
                sectionId={summarySection.id}
                sectionType={summarySection.section_type}
                title={TEXT_SECTION_LABELS["findings_summary"]}
                initialBodyText={summarySection.body_text ?? ""}
                readOnly={!canEditReport}
              />
            </div>
          )}

          {/* Crown Jewel Analysis */}
          {crownSection && (
            <div id="rb-crown-jewel">
              <SectionTextBox
                sectionId={crownSection.id}
                sectionType={crownSection.section_type}
                title={TEXT_SECTION_LABELS["crown_jewel"]}
                initialBodyText={crownSection.body_text ?? ""}
                readOnly={!canEditReport}
              />
            </div>
          )}

          {/* Findings Overview Chart */}
          <div id="rb-findings-overview">
            <FindingsOverviewChart findings={allFindings} />
          </div>

          {/* Findings with severity sections */}
          <div id="rb-findings">
            <FindingsSection
              reportId={report.id}
              sections={sections}
              findingsBySection={findingsBySection}
              canAdd={canAddFindings}
              canEdit={canEditFinding}
              canDelete={canDeleteFinding}
              onRefetch={handleRefetch}
            />
          </div>

          {/* Conclusion */}
          {closingSection && (
            <div id="rb-conclusion">
              <SectionTextBox
                sectionId={closingSection.id}
                sectionType={closingSection.section_type}
                title={TEXT_SECTION_LABELS["closing"]}
                initialBodyText={closingSection.body_text ?? ""}
                readOnly={!canEditReport}
              />
            </div>
          )}
        </div>

        {/* ── Right actions panel ── */}
        <ReportActionsPanel
          report={report}
          findings={allFindings}
          canEditReport={canEditReport}
        />
      </div>
    </div>
  );
}
