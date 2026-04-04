import React from "react";
import type { Finding } from "../../../types/models";

// ── Types ──────────────────────────────────────────────────────────────────

interface TocItem {
  id: string;
  label: string;
  level: 0 | 1;
  severity?: string;
}

interface TableOfContentsProps {
  findingsBySection: Record<string, Finding[]>;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TOP_ITEMS: TocItem[] = [
  { id: "rb-title",            label: "Report Title",        level: 0 },
  { id: "rb-exec-summary",     label: "Executive Summary",   level: 0 },
  { id: "rb-findings-review",  label: "Findings Review",     level: 0 },
  { id: "rb-crown-jewel",      label: "Crown Jewel",         level: 0 },
  { id: "rb-findings-overview",label: "Findings Overview",   level: 0 },
  { id: "rb-findings",         label: "Findings",            level: 0 },
];

const SEVERITY_ITEMS: TocItem[] = [
  { id: "rb-sev-critical",     label: "Critical",     level: 1, severity: "critical" },
  { id: "rb-sev-high",         label: "High",         level: 1, severity: "high" },
  { id: "rb-sev-medium",       label: "Medium",       level: 1, severity: "medium" },
  { id: "rb-sev-low",          label: "Low",          level: 1, severity: "low" },
  { id: "rb-sev-informational",label: "Informational",level: 1, severity: "informational" },
];

const BOTTOM_ITEMS: TocItem[] = [
  { id: "rb-conclusion", label: "Conclusion", level: 0 },
];

const ALL_ITEMS = [...TOP_ITEMS, ...SEVERITY_ITEMS, ...BOTTOM_ITEMS];

const SEVERITY_COLORS: Record<string, string> = {
  critical:     "var(--severity-critical)",
  high:         "var(--severity-high)",
  medium:       "var(--severity-medium)",
  low:          "var(--severity-low)",
  informational:"var(--severity-info)",
};

const BREADCRUMB_HEIGHT = 52; // px — sticky breadcrumb bar height

// ── Component ──────────────────────────────────────────────────────────────

export function TableOfContents({ findingsBySection }: TableOfContentsProps) {
  const [activeId, setActiveId] = React.useState<string>("rb-title");

  // Count findings per severity across all sections
  const allFindings = Object.values(findingsBySection).flat();
  const countBySeverity: Record<string, number> = {};
  for (const f of allFindings) {
    countBySeverity[f.severity_effective] = (countBySeverity[f.severity_effective] ?? 0) + 1;
  }

  // Track active section via IntersectionObserver
  React.useEffect(() => {
    const ids = ALL_ITEMS.map((i) => i.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    // Use scroll position to determine the topmost visible section
    const onScroll = () => {
      let currentId = ids[0];
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= BREADCRUMB_HEIGHT + 32) {
          currentId = el.id;
        }
      }
      setActiveId(currentId);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // run once on mount

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - BREADCRUMB_HEIGHT - 16;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const renderItem = (item: TocItem) => {
    const isActive = activeId === item.id;
    const count =
      item.severity != null ? (countBySeverity[item.severity] ?? 0) : null;
    const dotColor = item.severity ? SEVERITY_COLORS[item.severity] : null;

    return (
      <button
        key={item.id}
        onClick={() => scrollTo(item.id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          width: "100%",
          padding: item.level === 1 ? "4px 8px 4px 20px" : "5px 8px",
          background: isActive ? "var(--color-primary-light, #eff6ff)" : "transparent",
          border: "none",
          borderLeft: isActive
            ? "2px solid var(--color-primary)"
            : "2px solid transparent",
          borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.15s, border-color 0.15s",
          marginBottom: 1,
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = "var(--color-gray-100)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Severity dot */}
        {dotColor && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: dotColor,
              flexShrink: 0,
            }}
          />
        )}

        {/* Label */}
        <span
          style={{
            flex: 1,
            fontSize: item.level === 1 ? 12 : 13,
            fontWeight: isActive ? 600 : item.level === 0 ? 500 : 400,
            color: isActive
              ? "var(--color-primary)"
              : item.level === 0
              ? "var(--color-gray-700)"
              : "var(--color-gray-500)",
            lineHeight: 1.4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.label}
        </span>

        {/* Count badge for severity items */}
        {count != null && count > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: dotColor ?? "var(--color-gray-500)",
              background: "transparent",
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <nav
      aria-label="Page navigation"
      style={{
        position: "sticky",
        top: BREADCRUMB_HEIGHT + 24,
        width: 192,
        flexShrink: 0,
        alignSelf: "flex-start",
        maxHeight: `calc(100vh - ${BREADCRUMB_HEIGHT + 48}px)`,
        overflowY: "auto",
        overflowX: "hidden",
        paddingBottom: 24,
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-gray-400)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
          padding: "0 8px",
        }}
      >
        On this page
      </p>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {TOP_ITEMS.map(renderItem)}

        {/* Severity sub-items */}
        <div style={{ marginTop: 1, marginBottom: 1 }}>
          {SEVERITY_ITEMS.map(renderItem)}
        </div>

        {BOTTOM_ITEMS.map(renderItem)}
      </div>
    </nav>
  );
}
