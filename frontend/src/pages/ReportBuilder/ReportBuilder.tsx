import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageLoader } from "../../components/loading/PageLoader";
import { ErrorState } from "../../components/ui/ErrorState";
import { getReport } from "../../api/reports";
import { getEngagement } from "../../api/engagements";
import { getFindingsBySection } from "../../api/findings";
import { usePermissions } from "../../hooks/usePermission";
import { useReportBuilderStore } from "../../store/reportBuilderStore";
import { ReportTitleBox } from "./components/ReportTitleBox";
import { SectionTextBox } from "./components/SectionTextBox";
import { FindingsOverviewChart } from "./components/FindingsOverviewChart";
import { FindingsSection } from "./components/FindingsSection";
import { ReportActionsPanel } from "./components/ReportActionsPanel";
import { TableOfContents } from "./components/TableOfContents";
import { getTemplatesForType } from "../../api/templates";
import { TYPE_LABEL } from "../engagements/EngagementsPage";
import type { EngagementType, Finding, ReportSection } from "../../types/models";

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

  // Fetch engagement for builder type badge (only if report is linked)
  const { data: engagement } = useQuery({
    queryKey: ["engagement", report?.engagement_id],
    queryFn: () => getEngagement(report!.engagement_id!),
    enabled: !!report?.engagement_id,
    staleTime: 120_000,
  });

  // Fetch default templates for this engagement type so sections with no saved
  // body_text (e.g. reports created before templates were configured, or where
  // seeding silently produced null) still show the expected template content.
  const engagementTypeValue = engagement?.types?.[0] as EngagementType | undefined;
  const { data: templateEntries = [] } = useQuery({
    queryKey: ["templates", engagementTypeValue],
    queryFn: () => getTemplatesForType(engagementTypeValue!),
    enabled: !!engagementTypeValue,
    staleTime: 120_000,
  });
  // Build section_type → default_body lookup
  const templateMap = React.useMemo(
    () => Object.fromEntries(templateEntries.map((t) => [t.section_type, t.default_body ?? ""])),
    [templateEntries]
  );

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

  // Sections sorted by position (filters out severity sub-sections for the main loop)
  const sortedSections = [...sections].sort((a, b) => a.position - b.position);
  const hasReportTitleSection = sortedSections.some((s) => s.section_type === "report_title");

  const handleRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ["report-sections-with-findings", reportId] });
    refetchSections();
  };

  // Engagement type badge label
  const engagementTypeBadge = engagement?.types?.[0]
    ? (TYPE_LABEL[engagement.types[0] as EngagementType] ?? engagement.types[0])
    : null;

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
        {engagementTypeBadge && (
          <>
            <span style={{ fontSize: 13, color: "var(--color-gray-300)" }}>/</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "2px 10px",
                borderRadius: 999,
                background: "var(--color-primary-light, #eff6ff)",
                color: "var(--color-primary)",
                border: "1px solid #bfdbfe",
              }}
            >
              {engagementTypeBadge}
            </span>
          </>
        )}
      </div>

      {/* Three-column layout: TOC (left) + content (centre) + actions (right) */}
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
        <TableOfContents sections={sortedSections} findingsBySection={findingsBySection} />

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
          {/* Legacy fallback: if no report_title section exists (old reports),
              render the title box outside the loop using report.title */}
          {!hasReportTitleSection && (
            <div id="rb-legacy-title">
              <ReportTitleBox
                reportId={report.id}
                initialTitle={report.title}
                readOnly={!canEditReport}
              />
            </div>
          )}

          {/* Position-ordered section render loop */}
          {sortedSections.map((section) => {
            // Skip severity sub-sections — rendered inside FindingsSection
            if (section.severity_filter !== null) return null;

            const sectionId = `rb-section-${section.id}`;

            if (section.section_type === "report_title") {
              return (
                <div key={section.id} id={sectionId}>
                  <ReportTitleBox
                    reportId={report.id}
                    sectionId={section.id}
                    initialTitle={section.body_text ?? report.title}
                    readOnly={!canEditReport}
                  />
                </div>
              );
            }

            if (section.section_type === "findings") {
              return (
                <React.Fragment key={section.id}>
                  <div id="rb-findings-overview">
                    <FindingsOverviewChart findings={allFindings} />
                  </div>
                  <div id={sectionId}>
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
                </React.Fragment>
              );
            }

            return (
              <div key={section.id} id={sectionId}>
                <SectionTextBox
                  sectionId={section.id}
                  sectionType={section.section_type}
                  title={section.title ?? section.section_type.replace(/_/g, " ")}
                  initialBodyText={section.body_text ?? ""}
                  templateBodyText={templateMap[section.section_type] ?? ""}
                  isVisible={section.is_visible}
                  canToggleVisibility={canEditReport}
                  readOnly={!canEditReport}
                />
              </div>
            );
          })}

          {/* Legacy fallback: if no findings section exists (old reports),
              render the overview chart + findings section at the bottom */}
          {!sortedSections.some((s) => s.section_type === "findings") && (
            <>
              <div id="rb-findings-overview">
                <FindingsOverviewChart findings={allFindings} />
              </div>
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
            </>
          )}
        </div>

        {/* ── Right actions panel ── */}
        <ReportActionsPanel
          report={report}
          findings={allFindings}
          canEditReport={canEditReport}
          engagement={engagement}
        />
      </div>
    </div>
  );
}
