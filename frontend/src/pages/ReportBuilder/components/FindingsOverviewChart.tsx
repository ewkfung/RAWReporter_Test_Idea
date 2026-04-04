import type { Finding } from "../../../types/models";

interface FindingsOverviewChartProps {
  findings: Finding[];
}

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "informational"] as const;
const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Informational",
};
const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--severity-critical)",
  high: "var(--severity-high)",
  medium: "var(--severity-medium)",
  low: "var(--severity-low)",
  informational: "var(--severity-info)",
};

export function FindingsOverviewChart({ findings }: FindingsOverviewChartProps) {
  const counts = SEVERITY_ORDER.map((sev) => ({
    severity: sev,
    count: findings.filter((f) => f.severity_effective === sev).length,
  }));

  const maxCount = Math.max(...counts.map((c) => c.count), 1);
  const totalFindings = findings.length;

  // Chart dimensions
  const width = 560;
  const height = 220;
  const labelWidth = 110;
  const barAreaWidth = width - labelWidth - 60;
  const rowHeight = 36;
  const barHeight = 20;
  const topPad = 10;

  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-200)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-gray-900)", margin: 0 }}>
          Findings Overview
        </h3>
        <span style={{ fontSize: 13, color: "var(--color-gray-500)" }}>
          {totalFindings} {totalFindings === 1 ? "finding" : "findings"} total
        </span>
      </div>

      {totalFindings === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-gray-400)", textAlign: "center", padding: "32px 0" }}>
          No findings added yet. Add findings from the library below.
        </p>
      ) : (
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          style={{ overflow: "visible" }}
        >
          {counts.map(({ severity, count }, i) => {
            const y = topPad + i * rowHeight;
            const barW = maxCount > 0 ? (count / maxCount) * barAreaWidth : 0;

            return (
              <g key={severity}>
                {/* Label */}
                <text
                  x={labelWidth - 8}
                  y={y + barHeight / 2 + 5}
                  textAnchor="end"
                  style={{ fontSize: 12, fill: "var(--color-gray-600)", fontFamily: "var(--font-sans)" }}
                >
                  {SEVERITY_LABELS[severity]}
                </text>

                {/* Background track */}
                <rect
                  x={labelWidth}
                  y={y}
                  width={barAreaWidth}
                  height={barHeight}
                  rx={4}
                  fill="var(--color-gray-100)"
                />

                {/* Filled bar */}
                {count > 0 && (
                  <rect
                    x={labelWidth}
                    y={y}
                    width={barW}
                    height={barHeight}
                    rx={4}
                    fill={SEVERITY_COLORS[severity]}
                    opacity={0.85}
                  />
                )}

                {/* Count label */}
                <text
                  x={labelWidth + barAreaWidth + 10}
                  y={y + barHeight / 2 + 5}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fill: count > 0 ? SEVERITY_COLORS[severity] : "var(--color-gray-400)",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {count}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
