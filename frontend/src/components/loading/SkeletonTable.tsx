/**
 * Animated skeleton placeholder for list pages (Clients, Engagements,
 * Reports, Library). Renders `rows` shimmer rows that mimic the real row
 * shape: chevron + title bar + badge pill + action button.
 */

const SHIMMER_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(90deg, var(--color-gray-100) 25%, var(--color-gray-200) 50%, var(--color-gray-100) 75%)",
  backgroundSize: "200% 100%",
  animation: "rr-shimmer 1.4s ease-in-out infinite",
  borderRadius: 4,
};

interface SkeletonTableProps {
  rows?: number;
}

function SkeletonRow({ index }: { index: number }) {
  // Vary the title width slightly so rows don't all look identical
  const titleWidths = ["55%", "45%", "60%", "40%", "50%"];
  const titleWidth = titleWidths[index % titleWidths.length];

  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-200)",
        borderRadius: "var(--radius-md)",
        marginBottom: 8,
        padding: "14px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Chevron placeholder */}
      <div style={{ width: 14, height: 14, flexShrink: 0, ...SHIMMER_STYLE }} />
      {/* Title */}
      <div style={{ flex: 1, height: 15, maxWidth: titleWidth, ...SHIMMER_STYLE }} />
      {/* Badge pill */}
      <div style={{ width: 64, height: 20, borderRadius: 999, ...SHIMMER_STYLE }} />
      {/* Action button */}
      <div style={{ width: 72, height: 28, borderRadius: "var(--radius-sm)", ...SHIMMER_STYLE }} />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: SkeletonTableProps) {
  return (
    <>
      <style>{`
        @keyframes rr-shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} index={i} />
        ))}
      </div>
    </>
  );
}
