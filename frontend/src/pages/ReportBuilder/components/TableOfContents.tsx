import React from "react";
import type { Finding, ReportSection } from "../../../types/models";

// ── Types ──────────────────────────────────────────────────────────────────

interface TocItem {
  id: string;
  label: string;
  level: 0 | 1;
  severity?: string;
}

interface TableOfContentsProps {
  sections: ReportSection[];   // sorted by position, all sections including severity
  findingsBySection: Record<string, Finding[]>;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical:      "var(--severity-critical)",
  high:          "var(--severity-high)",
  medium:        "var(--severity-medium)",
  low:           "var(--severity-low)",
  informational: "var(--severity-info)",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical:      "Critical",
  high:          "High",
  medium:        "Medium",
  low:           "Low",
  informational: "Informational",
};

const BREADCRUMB_HEIGHT = 52; // px — sticky breadcrumb bar height

// ── Helpers ────────────────────────────────────────────────────────────────

function buildTocItems(sections: ReportSection[]): TocItem[] {
  const items: TocItem[] = [];

  // Legacy fallback: if there's no report_title section, add a static title entry
  const hasReportTitle = sections.some((s) => s.section_type === "report_title");
  if (!hasReportTitle) {
    items.push({ id: "rb-legacy-title", label: "Report Title", level: 0 });
  }

  for (const section of sections) {
    // Skip severity sub-sections — they appear as children of the findings block
    if (section.severity_filter !== null) continue;

    if (section.section_type === "findings") {
      items.push({
        id: `rb-section-${section.id}`,
        label: section.title ?? "Findings",
        level: 0,
      });
      // Add severity sub-items (use the ids set by FindingsSection)
      for (const sev of ["critical", "high", "medium", "low", "informational"]) {
        items.push({
          id: `rb-sev-${sev}`,
          label: SEVERITY_LABEL[sev],
          level: 1,
          severity: sev,
        });
      }
      continue;
    }

    items.push({
      id: `rb-section-${section.id}`,
      label: section.title ?? section.section_type.replace(/_/g, " "),
      level: 0,
    });
  }

  // Legacy fallback: if there's no findings section, add static findings entries
  const hasFindings = sections.some((s) => s.section_type === "findings");
  if (!hasFindings) {
    items.push({ id: "rb-findings-overview", label: "Findings Overview", level: 0 });
    items.push({ id: "rb-findings", label: "Findings", level: 0 });
    for (const sev of ["critical", "high", "medium", "low", "informational"]) {
      items.push({ id: `rb-sev-${sev}`, label: SEVERITY_LABEL[sev], level: 1, severity: sev });
    }
  }

  return items;
}

// ── Component ──────────────────────────────────────────────────────────────

export function TableOfContents({ sections, findingsBySection }: TableOfContentsProps) {
  const tocItems = React.useMemo(() => buildTocItems(sections), [sections]);
  const [activeId, setActiveId] = React.useState<string>("");

  // Count findings per severity across all sections
  const allFindings = Object.values(findingsBySection).flat();
  const countBySeverity: Record<string, number> = {};
  for (const f of allFindings) {
    countBySeverity[f.severity_effective] = (countBySeverity[f.severity_effective] ?? 0) + 1;
  }

  // Track active section via scroll position
  React.useEffect(() => {
    const ids = tocItems.map((i) => i.id);
    const getElements = () =>
      ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];

    const onScroll = () => {
      const elements = getElements();
      if (elements.length === 0) return;
      let currentId = ids[0] ?? "";
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= BREADCRUMB_HEIGHT + 32) {
          currentId = el.id;
        }
      }
      setActiveId(currentId);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [tocItems]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - BREADCRUMB_HEIGHT - 16;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const renderItem = (item: TocItem) => {
    const isActive = activeId === item.id;
    const count = item.severity != null ? (countBySeverity[item.severity] ?? 0) : null;
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
        {dotColor && (
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        )}
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
        {count != null && count > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: dotColor ?? "var(--color-gray-500)",
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
        {tocItems.map(renderItem)}
      </div>
    </nav>
  );
}
