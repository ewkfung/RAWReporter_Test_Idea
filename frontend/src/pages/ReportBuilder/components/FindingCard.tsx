import React from "react";
import { SeverityBadge, Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { Select } from "../../../components/ui/Select";
import { Toggle } from "../../../components/ui/Toggle";
import { ConfirmModal } from "../../../components/ui/ConfirmModal";
import { Spinner } from "../../../components/ui/Spinner";
import {
  updateFinding,
  replaceFindingReferences,
  deleteFinding,
  type FindingRefUpsert,
} from "../../../api/findings";
import { useToast } from "../../../components/ui/useToast";
import { useUnsavedChanges } from "../../../hooks/useUnsavedChanges";
import type { Finding, Severity } from "../../../types/models";

// ── Types ──────────────────────────────────────────────────────────────────

interface FindingCardProps {
  finding: Finding;
  readOnly?: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}

type RefType = "cve" | "cwe" | "cisa" | "nist" | "nvd" | "manufacturer";

interface RefEntry {
  identifier: string;
  url: string;
}

interface RefState {
  enabled: boolean;
  entries: RefEntry[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const REF_TYPES: Array<{ type: RefType; label: string; enabledKey: string }> = [
  { type: "cve",          label: "CVE",          enabledKey: "ref_cve_enabled" },
  { type: "cwe",          label: "CWE",          enabledKey: "ref_cwe_enabled" },
  { type: "cisa",         label: "CISA",         enabledKey: "ref_cisa_enabled" },
  { type: "nist",         label: "NIST",         enabledKey: "ref_nist_enabled" },
  { type: "nvd",          label: "NVD",          enabledKey: "ref_nvd_enabled" },
  { type: "manufacturer", label: "Manufacturer", enabledKey: "ref_manufacturer_enabled" },
];

const SEVERITY_OVERRIDE_OPTIONS = [
  { value: "",              label: "No override (use default)" },
  { value: "critical",     label: "Critical" },
  { value: "high",         label: "High" },
  { value: "medium",       label: "Medium" },
  { value: "low",          label: "Low" },
  { value: "informational", label: "Informational" },
];

const MIN_JUSTIFICATION = 20;

// ── Helpers ────────────────────────────────────────────────────────────────

function buildEmptyRefs(): Record<RefType, RefState> {
  const r = {} as Record<RefType, RefState>;
  for (const { type } of REF_TYPES) r[type] = { enabled: false, entries: [] };
  return r;
}

function refsFromFinding(finding: Finding): Record<RefType, RefState> {
  const r = buildEmptyRefs();
  for (const { type, enabledKey } of REF_TYPES) {
    r[type].enabled = Boolean((finding as unknown as Record<string, unknown>)[enabledKey]);
    r[type].entries = finding.references
      .filter((ref) => ref.ref_type === type && ref.is_visible)
      .map((ref) => ({ identifier: ref.identifier, url: ref.url ?? "" }));
  }
  return r;
}

// ── Component ──────────────────────────────────────────────────────────────

export function FindingCard({ finding, readOnly, onSaved, onDeleted }: FindingCardProps) {
  const toast = useToast();

  // ── Expand/collapse ───────────────────────────────────────────────────

  const [isExpanded, setIsExpanded] = React.useState(false);
  const wasExpandedRef = React.useRef(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const markDirty = React.useCallback(() => setHasChanges(true), []);
  const { blocker } = useUnsavedChanges(isExpanded && hasChanges);

  // ── Form state ────────────────────────────────────────────────────────

  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [observation, setObservation] = React.useState("");
  const [recommendation, setRecommendation] = React.useState("");
  const [remSteps, setRemSteps] = React.useState("");
  const [remEnabled, setRemEnabled] = React.useState(true);
  const [severityOverride, setSeverityOverride] = React.useState("");
  const [cvssOverrideEnabled, setCvssOverrideEnabled] = React.useState(false);
  const [cvssOverride, setCvssOverride] = React.useState("");
  const [justification, setJustification] = React.useState("");
  const [refs, setRefs] = React.useState<Record<RefType, RefState>>(buildEmptyRefs);

  // ── Action state ──────────────────────────────────────────────────────

  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  const manageRef = React.useRef<HTMLDivElement>(null);

  // ── Init form on expand ───────────────────────────────────────────────

  React.useEffect(() => {
    if (isExpanded && !wasExpandedRef.current) {
      // Just opened — load current finding values
      setTitle(finding.title);
      setSummary(finding.summary);
      setObservation(finding.observation);
      setRecommendation(finding.recommendation);
      setRemSteps(finding.remediation_steps);
      setRemEnabled(finding.remediation_steps_enabled);
      setSeverityOverride(finding.severity_override ?? "");
      setCvssOverrideEnabled(finding.cvss_score_override != null);
      setCvssOverride(finding.cvss_score_override?.toString() ?? "");
      setJustification(finding.override_justification ?? "");
      setRefs(refsFromFinding(finding));
      setSaveError(null);
      setFieldErrors({});
      setHasChanges(false);
    }
    wasExpandedRef.current = isExpanded;
  }, [isExpanded, finding]);

  // ── Close manage dropdown on outside click ────────────────────────────

  React.useEffect(() => {
    if (!manageOpen) return;
    const handler = (e: MouseEvent) => {
      if (manageRef.current && !manageRef.current.contains(e.target as Node)) {
        setManageOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [manageOpen]);

  // ── Ref helpers ───────────────────────────────────────────────────────

  const updateRefEnabled = (type: RefType, enabled: boolean) => {
    markDirty();
    setRefs((p) => ({ ...p, [type]: { ...p[type], enabled } }));
  };

  const addRefEntry = (type: RefType) => {
    markDirty();
    setRefs((p) => ({
      ...p,
      [type]: { ...p[type], entries: [...p[type].entries, { identifier: "", url: "" }] },
    }));
  };

  const removeRefEntry = (type: RefType, idx: number) => {
    markDirty();
    setRefs((p) => ({
      ...p,
      [type]: { ...p[type], entries: p[type].entries.filter((_, i) => i !== idx) },
    }));
  };

  const updateRefEntry = (type: RefType, idx: number, field: "identifier" | "url", val: string) => {
    markDirty();
    setRefs((p) => ({
      ...p,
      [type]: {
        ...p[type],
        entries: p[type].entries.map((e, i) => (i === idx ? { ...e, [field]: val } : e)),
      },
    }));
  };

  // ── Validation ────────────────────────────────────────────────────────

  const needsJustification = severityOverride !== "" || finding.is_placement_override;
  const justificationValid =
    !needsJustification || justification.trim().length >= MIN_JUSTIFICATION;
  const canSave = title.trim().length > 0 && summary.trim().length > 0 && justificationValid;

  const setFieldError = (field: string, msg: string) =>
    setFieldErrors((prev) => {
      if (!msg) { const n = { ...prev }; delete n[field]; return n; }
      return { ...prev, [field]: msg };
    });

  // ── Save ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required";
    if (!summary.trim()) errs.summary = "Summary is required";
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const newSeverity = severityOverride === "" ? null : (severityOverride as Severity);
      await updateFinding(finding.id, {
        title: title.trim(),
        summary: summary.trim(),
        observation: observation.trim(),
        recommendation: recommendation.trim(),
        remediation_steps: remSteps.trim(),
        remediation_steps_enabled: remEnabled,
        cvss_score_override:
          cvssOverrideEnabled && cvssOverride !== "" ? parseFloat(cvssOverride) : undefined,
        severity_override: newSeverity ?? undefined,
        override_justification: needsJustification ? justification : undefined,
        ref_cve_enabled:          refs.cve.enabled,
        ref_cwe_enabled:          refs.cwe.enabled,
        ref_cisa_enabled:         refs.cisa.enabled,
        ref_nist_enabled:         refs.nist.enabled,
        ref_nvd_enabled:          refs.nvd.enabled,
        ref_manufacturer_enabled: refs.manufacturer.enabled,
      });

      const refPayload: FindingRefUpsert[] = REF_TYPES.flatMap(({ type }) => {
        if (!refs[type].enabled) return [];
        return refs[type].entries
          .filter((e) => e.identifier.trim())
          .map((e) => ({
            ref_type: type,
            identifier: e.identifier.trim(),
            url: e.url.trim() || null,
            description: null,
            is_visible: true,
          }));
      });
      await replaceFindingReferences(finding.id, refPayload);

      toast.success("Finding saved");
      setIsExpanded(false);
      onSaved();
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteFinding(finding.id);
      toast.success("Finding deleted");
      onDeleted();
    } catch {
      toast.error("Failed to delete finding");
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  const hasOverride = finding.severity_override != null;
  const hasMissingJustification =
    finding.is_placement_override &&
    (!finding.override_justification || finding.override_justification.trim() === "");

  return (
    <>
      <div
        style={{
          background: "var(--color-white)",
          border: `1px solid ${isExpanded ? "var(--color-primary)" : "var(--color-gray-200)"}`,
          borderLeft: finding.is_placement_override
            ? `4px solid var(--color-warning)`
            : isExpanded
            ? `4px solid var(--color-primary)`
            : "4px solid transparent",
          borderRadius: "var(--radius-md)",
          boxShadow: isExpanded ? "var(--shadow-md)" : "var(--shadow-sm)",
          transition: "box-shadow 0.15s, border-color 0.15s",
          overflow: "visible",
        }}
      >
        {/* ── Collapsed header — always visible ── */}
        <div
          onClick={() => !readOnly && setIsExpanded((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 14px",
            cursor: readOnly ? "default" : "pointer",
            userSelect: "none",
          }}
        >
          {hasOverride && (
            <Badge variant="warning" style={{ fontSize: 10 }}>
              Severity overridden
            </Badge>
          )}
          {hasMissingJustification && (
            <Badge variant="critical" style={{ fontSize: 10 }}>
              Needs justification
            </Badge>
          )}
          {finding.is_placement_override && !hasMissingJustification && (
            <Badge variant="warning" style={{ fontSize: 10 }}>
              Placement override
            </Badge>
          )}

          <span
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-gray-900)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {finding.title}
          </span>

          {/* Chevron */}
          {!readOnly && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{
                flexShrink: 0,
                color: "var(--color-gray-400)",
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>


        {/* ── Expanded form ── */}
        {isExpanded && (
          <div
            style={{ borderTop: "1px solid var(--color-gray-100)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 20px 0" }}>

              {/* Two-column grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 20,
                  marginBottom: 20,
                }}
              >
                {/* Left column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Input
                    label="Title"
                    required
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); markDirty(); }}
                    onBlur={() => setFieldError("title", title.trim() ? "" : "Title is required")}
                    error={fieldErrors.title}
                  />

                  {/* Severity */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={labelStyle}>Severity</span>
                      <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>Default:</span>
                      <SeverityBadge severity={finding.severity_default} />
                    </div>
                    <Select
                      label="Severity Override"
                      value={severityOverride}
                      onChange={(e) => { setSeverityOverride(e.target.value); markDirty(); }}
                      options={SEVERITY_OVERRIDE_OPTIONS}
                    />
                    {severityOverride !== "" &&
                      severityOverride !== finding.severity_default && (
                        <p style={{ fontSize: 12, color: "var(--color-warning)", margin: 0 }}>
                          Changing severity may move this finding to a different section. Provide a
                          justification below.
                        </p>
                      )}
                  </div>

                  {/* CVSS Override */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <span style={labelStyle}>CVSS Override</span>
                        {finding.cvss_score_default != null && (
                          <span style={{ fontSize: 12, color: "var(--color-gray-500)", marginLeft: 8 }}>
                            Default: {finding.cvss_score_default.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <Toggle
                        checked={cvssOverrideEnabled}
                        onChange={(val) => {
                          setCvssOverrideEnabled(val);
                          if (!val) setCvssOverride("");
                          markDirty();
                        }}
                        label={cvssOverrideEnabled ? "On" : "Off"}
                      />
                    </div>
                    {cvssOverrideEnabled && (
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={cvssOverride}
                        onChange={(e) => { setCvssOverride(e.target.value); markDirty(); }}
                        hint="0.0 – 10.0"
                      />
                    )}
                  </div>

                  {/* Override Justification */}
                  {needsJustification && (
                    <Textarea
                      label="Override Justification"
                      required
                      value={justification}
                      onChange={(e) => { setJustification(e.target.value); markDirty(); }}
                      placeholder="Explain why severity is overridden or finding is in a mismatched section…"
                      style={{ minHeight: 80 }}
                      hint={`${justification.trim().length} / ${MIN_JUSTIFICATION} min characters`}
                      error={
                        justification.trim().length > 0 &&
                        justification.trim().length < MIN_JUSTIFICATION
                          ? `At least ${MIN_JUSTIFICATION} characters required`
                          : undefined
                      }
                    />
                  )}
                </div>

                {/* Right column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Textarea
                    label="Summary"
                    required
                    value={summary}
                    onChange={(e) => { setSummary(e.target.value); markDirty(); }}
                    onBlur={() => setFieldError("summary", summary.trim() ? "" : "Summary is required")}
                    error={fieldErrors.summary}
                    style={{ minHeight: 80 }}
                  />
                  <Textarea
                    label="Observation"
                    value={observation}
                    onChange={(e) => { setObservation(e.target.value); markDirty(); }}
                    style={{ minHeight: 80 }}
                  />
                  <Textarea
                    label="Recommendation"
                    value={recommendation}
                    onChange={(e) => { setRecommendation(e.target.value); markDirty(); }}
                    style={{ minHeight: 80 }}
                  />
                  <Textarea
                    label="Remediation Steps"
                    value={remSteps}
                    onChange={(e) => { setRemSteps(e.target.value); markDirty(); }}
                    style={{ minHeight: 80 }}
                  />
                  <div>
                    <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>
                      Remediation Steps Enabled
                    </label>
                    <Toggle
                      checked={remEnabled}
                      onChange={(val) => { setRemEnabled(val); markDirty(); }}
                      label={remEnabled ? "Enabled" : "Disabled"}
                    />
                  </div>
                </div>
              </div>

              {/* References */}
              <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: 16, marginBottom: 20 }}>
                <p style={sectionHeadingStyle}>References</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {REF_TYPES.map(({ type, label }) => {
                    const state = refs[type];
                    return (
                      <div
                        key={type}
                        style={{
                          border: "1px solid var(--color-gray-200)",
                          borderRadius: "var(--radius-md)",
                          padding: "10px 12px",
                          opacity: state.enabled ? 1 : 0.55,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: state.enabled ? 10 : 0,
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-800)" }}>
                            {label}
                          </span>
                          <Toggle
                            checked={state.enabled}
                            onChange={(val) => updateRefEnabled(type, val)}
                          />
                        </div>

                        {state.enabled && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {state.entries.map((entry, idx) => (
                              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <div style={{ flex: 1 }}>
                                  <Input
                                    placeholder={`${label} identifier`}
                                    value={entry.identifier}
                                    onChange={(e) => updateRefEntry(type, idx, "identifier", e.target.value)}
                                  />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <Input
                                    placeholder="URL (optional)"
                                    value={entry.url}
                                    onChange={(e) => updateRefEntry(type, idx, "url", e.target.value)}
                                  />
                                </div>
                                <button
                                  onClick={() => removeRefEntry(type, idx)}
                                  style={{
                                    marginTop: 6,
                                    flexShrink: 0,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--color-gray-400)",
                                    fontSize: 16,
                                    lineHeight: 1,
                                    padding: "4px 6px",
                                  }}
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addRefEntry(type)}
                              style={{
                                alignSelf: "flex-start",
                                fontSize: 12,
                                fontWeight: 500,
                                color: "var(--color-primary)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              + Add {label}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer: Save + Manage */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8,
                padding: "12px 20px",
                borderTop: "1px solid var(--color-gray-100)",
                background: "var(--color-gray-50)",
                borderRadius: "0 0 var(--radius-md) var(--radius-md)",
              }}
            >
              {saveError && (
                <span style={{ fontSize: 12, color: "var(--color-danger)", marginRight: "auto" }}>
                  {saveError}
                </span>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsExpanded(false)}
                disabled={saving}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                loading={saving}
                disabled={!canSave}
              >
                Save Changes
              </Button>

              {/* Manage dropdown */}
              <div ref={manageRef} style={{ position: "relative" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setManageOpen((v) => !v);
                  }}
                >
                  Manage
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    style={{ marginLeft: 2, transform: manageOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
                  >
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>

                {manageOpen && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 4px)",
                      right: 0,
                      background: "var(--color-white)",
                      border: "1px solid var(--color-gray-200)",
                      borderRadius: "var(--radius-md)",
                      boxShadow: "var(--shadow-md)",
                      zIndex: 300,
                      minWidth: 140,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      onClick={() => {
                        setManageOpen(false);
                        setConfirmDelete(true);
                      }}
                      disabled={deleting}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "9px 14px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "var(--color-danger)",
                        fontWeight: 500,
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-danger-light)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      {deleting ? <Spinner size={12} /> : (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.7 7.5h6.6L11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      Delete Finding
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Finding"
        message={`Are you sure you want to delete "${finding.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
      />

      {/* Navigation blocker — fires when user navigates away with unsaved edits */}
      <ConfirmModal
        isOpen={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Unsaved Changes"
        message="You have unsaved changes to this finding. Leave without saving?"
        confirmLabel="Leave Without Saving"
        confirmVariant="danger"
      />
    </>
  );
}

// ── Shared local styles ────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-gray-700)",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--color-gray-400)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 10,
};
