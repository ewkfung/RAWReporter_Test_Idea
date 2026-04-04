import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SeverityBadge } from "../ui/Badge";
import { Spinner } from "../ui/Spinner";
import { getLibraryFindings, importLibraryFinding } from "../../api/library";
import type { Finding, LibraryFinding, Severity, ReportSection } from "../../types/models";

// ── Types ──────────────────────────────────────────────────────────────────

interface LibrarySelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  /** When provided, findings are imported into this specific section.
   *  When omitted, findings are auto-assigned to severity sections by the backend. */
  targetSection?: ReportSection;
  onFindingsAdded: (findings: Finding[]) => void;
}

type SeverityFilter = Severity | "all";

const SEVERITIES: Array<{ label: string; value: SeverityFilter }> = [
  { label: "All", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "Informational", value: "informational" },
];

const SECTION_LABEL: Record<string, string> = {
  critical_findings: "Critical Findings",
  high_findings: "High Findings",
  medium_findings: "Medium Findings",
  low_findings: "Low Findings",
  informational: "Informational",
  executive_summary: "Executive Summary",
  findings_summary: "Findings Summary",
  crown_jewel: "Crown Jewel",
  closing: "Closing",
  appendix: "Appendix",
};

// ── Component ──────────────────────────────────────────────────────────────

export function LibrarySelectModal({
  isOpen,
  onClose,
  reportId,
  targetSection,
  onFindingsAdded,
}: LibrarySelectModalProps) {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState<SeverityFilter>(
    targetSection?.severity_filter ?? "all"
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSearch("");
      setDebouncedSearch("");
      setSeverityFilter(targetSection?.severity_filter ?? "all");
      setSelected(new Set());
      setAddError(null);
    }
  }, [isOpen, targetSection?.severity_filter]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: findings = [], isLoading } = useQuery({
    queryKey: ["library-select", debouncedSearch, severityFilter],
    queryFn: () =>
      getLibraryFindings({
        search: debouncedSearch || undefined,
        severity: severityFilter !== "all" ? severityFilter : undefined,
      }),
    enabled: isOpen,
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisible = findings.map((f) => f.id);
  const allSelected = allVisible.length > 0 && allVisible.every((id) => selected.has(id));
  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allVisible.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        allVisible.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const selectedFindings = findings.filter((f) => selected.has(f.id));

  // Mismatch warning only applies when adding to a specific severity section
  const mismatchCount =
    targetSection?.severity_filter != null
      ? selectedFindings.filter((f) => f.severity !== targetSection.severity_filter).length
      : 0;

  const handleAdd = async () => {
    if (selectedFindings.length === 0) return;
    setAdding(true);
    setAddError(null);
    const added: Finding[] = [];
    const failed: string[] = [];

    for (const f of selectedFindings) {
      try {
        // Pass targetSection.id if available; otherwise backend auto-assigns by severity
        const result = await importLibraryFinding(f.id, reportId, targetSection?.id);
        added.push(result.finding);
      } catch {
        failed.push(f.title);
      }
    }

    setAdding(false);

    if (failed.length > 0) {
      setAddError(`Failed to import: ${failed.join(", ")}`);
    }

    if (added.length > 0) {
      onFindingsAdded(added);
    }
  };

  const sectionLabel = targetSection
    ? (targetSection.title ??
        SECTION_LABEL[targetSection.section_type] ??
        targetSection.section_type)
    : "All Sections (auto-assigned by severity)";

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 500,
    border: "1px solid",
    cursor: "pointer",
    background: active ? "var(--color-primary)" : "transparent",
    borderColor: active ? "var(--color-primary)" : "var(--color-gray-200)",
    color: active ? "var(--color-white)" : "var(--color-gray-600)",
    transition: "all 0.1s",
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Findings from Library"
      width="min(90vw, 760px)"
      footer={
        <>
          {addError && (
            <span style={{ fontSize: 13, color: "var(--color-danger)", marginRight: "auto" }}>
              {addError}
            </span>
          )}
          <Button variant="secondary" onClick={onClose} disabled={adding}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAdd}
            loading={adding}
            disabled={selected.size === 0}
          >
            Add {selected.size > 0 ? `${selected.size} ` : ""}
            {selected.size === 1 ? "Finding" : "Findings"}
          </Button>
        </>
      }
    >
      {/* Subtitle */}
      <p style={{ fontSize: 13, color: "var(--color-gray-500)", marginBottom: 14, marginTop: -4 }}>
        Adding to: <strong style={{ color: "var(--color-gray-700)" }}>{sectionLabel}</strong>
      </p>

      {/* Search + severity filter */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <Input
            placeholder="Search title or summary…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SEVERITIES.map(({ label, value }) => (
            <button
              key={value}
              style={pillStyle(severityFilter === value)}
              onClick={() => setSeverityFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Severity mismatch warning */}
      {mismatchCount > 0 && (
        <div
          style={{
            background: "var(--color-warning-bg, #fffbeb)",
            border: "1px solid var(--color-warning, #d97706)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            fontSize: 13,
            color: "var(--color-warning-text, #92400e)",
            marginBottom: 14,
          }}
        >
          {mismatchCount === 1
            ? "1 selected finding has a different severity than this section."
            : `${mismatchCount} selected findings have a different severity than this section.`}{" "}
          {mismatchCount === 1 ? "It" : "They"} will be flagged as placement overrides and will
          require a justification before the report can be generated.
        </div>
      )}

      {/* Select-all header + count */}
      {findings.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 10px",
            background: "var(--color-gray-50)",
            borderRadius: "var(--radius-sm)",
            marginBottom: 8,
            border: "1px solid var(--color-gray-200)",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)" }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              style={{ width: 15, height: 15, cursor: "pointer" }}
            />
            Select All
          </label>
          {selected.size > 0 && (
            <span style={{ fontSize: 12, color: "var(--color-primary)", fontWeight: 500 }}>
              {selected.size} {selected.size === 1 ? "finding" : "findings"} selected
            </span>
          )}
        </div>
      )}

      {/* Findings list */}
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
            <Spinner size={28} />
          </div>
        ) : findings.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-gray-400)", textAlign: "center", paddingTop: 32 }}>
            No findings match your search.
          </p>
        ) : (
          findings.map((f) => (
            <SelectableRow
              key={f.id}
              finding={f}
              checked={selected.has(f.id)}
              onToggle={() => toggleSelect(f.id)}
              hasMismatch={
                targetSection?.severity_filter != null &&
                f.severity !== targetSection.severity_filter
              }
            />
          ))
        )}
      </div>
    </Modal>
  );
}

// ── Selectable row ─────────────────────────────────────────────────────────

function SelectableRow({
  finding,
  checked,
  onToggle,
  hasMismatch,
}: {
  finding: LibraryFinding;
  checked: boolean;
  onToggle: () => void;
  hasMismatch: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div
      style={{
        background: checked ? "var(--color-primary-50, #eff6ff)" : "var(--color-white)",
        border: `1px solid ${checked ? "var(--color-primary-200, #bfdbfe)" : "var(--color-gray-200)"}`,
        borderRadius: "var(--radius-md)",
        marginBottom: 4,
      }}
    >
      {/* Row header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 12px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={onToggle}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          style={{ width: 15, height: 15, cursor: "pointer", flexShrink: 0 }}
        />
        <SeverityBadge severity={finding.severity} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)" }}>
          {finding.title}
        </span>
        {hasMismatch && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--color-warning, #d97706)",
              background: "var(--color-warning-bg, #fffbeb)",
              border: "1px solid var(--color-warning, #d97706)",
              borderRadius: 999,
              padding: "1px 7px",
              flexShrink: 0,
            }}
          >
            Severity mismatch
          </span>
        )}
        {/* Expand chevron */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 2,
            color: "var(--color-gray-400)",
            display: "flex",
            transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Expanded summary */}
      {expanded && finding.summary && (
        <div
          style={{
            borderTop: "1px solid var(--color-gray-100)",
            padding: "10px 14px 12px 40px",
            background: "var(--color-gray-50)",
          }}
        >
          <p style={{ fontSize: 12, color: "var(--color-gray-600)", lineHeight: 1.6, margin: 0 }}>
            {finding.summary}
          </p>
        </div>
      )}
    </div>
  );
}
