/**
 * Animated skeleton placeholder for Dashboard summary cards.
 * Renders `count` shimmer cards in the same grid layout as the real cards.
 */

const SHIMMER_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(90deg, var(--color-gray-100) 25%, var(--color-gray-200) 50%, var(--color-gray-100) 75%)",
  backgroundSize: "200% 100%",
  animation: "rr-shimmer 1.4s ease-in-out infinite",
  borderRadius: 4,
};

interface SkeletonCardProps {
  count?: number;
}

export function SkeletonCard({ count = 4 }: SkeletonCardProps) {
  return (
    <>
      <style>{`
        @keyframes rr-shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${count}, 1fr)`,
          gap: 16,
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "var(--color-white)",
              border: "1px solid var(--color-gray-200)",
              borderLeft: "4px solid var(--color-gray-200)",
              borderRadius: "var(--radius-md)",
              padding: 16,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            {/* Icon area */}
            <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", ...SHIMMER_STYLE, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              {/* Count */}
              <div style={{ width: 48, height: 28, marginBottom: 6, ...SHIMMER_STYLE }} />
              {/* Label */}
              <div style={{ width: "70%", height: 13, ...SHIMMER_STYLE }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
