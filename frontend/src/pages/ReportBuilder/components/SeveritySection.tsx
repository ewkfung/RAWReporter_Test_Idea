import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { FindingCard } from "./FindingCard";
import { useReportBuilderStore } from "../../../store/reportBuilderStore";
import type { Finding, ReportSection, Severity } from "../../../types/models";

interface SeveritySectionProps {
  section: ReportSection;
  findings: Finding[];
  onRefetch: () => void;
  readOnly?: boolean;
  canAdd?: boolean;
  onAdd?: () => void;
}

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical Findings",
  high: "High Findings",
  medium: "Medium Findings",
  low: "Low Findings",
  informational: "Informational",
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: "var(--severity-critical)",
  high: "var(--severity-high)",
  medium: "var(--severity-medium)",
  low: "var(--severity-low)",
  informational: "var(--severity-info)",
};

const SEVERITY_BADGE: Record<string, Severity> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  informational: "informational",
};

export function SeveritySection({
  section,
  findings,
  onRefetch,
  readOnly,
  canAdd,
  onAdd,
}: SeveritySectionProps) {
  const { removeFinding } = useReportBuilderStore();
  const sev = section.severity_filter ?? "informational";
  const label = section.title ?? SEVERITY_LABELS[sev] ?? sev;
  const borderColor = SEVERITY_BORDER[sev] ?? "var(--color-gray-300)";
  const badgeVariant = SEVERITY_BADGE[sev] ?? "neutral";

  // Sort by position ascending
  const sorted = [...findings].sort((a, b) => a.position - b.position);

  return (
    <div
      style={{
        borderLeft: `4px solid ${borderColor}`,
        paddingLeft: 16,
        marginBottom: 8,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h4
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--color-gray-900)",
            margin: 0,
          }}
        >
          {label}
        </h4>
        <Badge variant={badgeVariant}>
          {sorted.length} {sorted.length === 1 ? "finding" : "findings"}
        </Badge>
      </div>

      {/* Findings or empty state */}
      {sorted.length === 0 ? (
        <EmptyState
          title={`No ${label.toLowerCase()} yet.`}
          description={canAdd ? "Add findings from the library to populate this section." : undefined}
          action={canAdd && onAdd ? { label: "+ Add from Library", onClick: onAdd } : undefined}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              readOnly={readOnly}
              onSaved={onRefetch}
              onDeleted={() => removeFinding(finding.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
