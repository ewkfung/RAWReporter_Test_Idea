import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { Select } from "../../../components/ui/Select";
import { Toggle } from "../../../components/ui/Toggle";
import { SeverityBadge } from "../../../components/ui/Badge";
import { Spinner } from "../../../components/ui/Spinner";
import { getFinding, updateFinding, replaceFindingReferences, type FindingRefUpsert } from "../../../api/findings";
import { useToast } from "../../../components/ui/useToast";
import type { Severity } from "../../../types/models";

// ── Types ──────────────────────────────────────────────────────────────────

interface FindingFormModalProps {
  findingId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
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

const MIN_JUSTIFICATION_LEN = 20;

// ── Component ──────────────────────────────────────────────────────────────

export function FindingFormModal({ findingId, isOpen, onClose, onSave }: FindingFormModalProps) {
  const toast = useToast();

  const { data: finding, isLoading } = useQuery({
    queryKey: ["finding-edit", findingId],
    queryFn: () => getFinding(findingId),
    enabled: isOpen && !!findingId,
    staleTime: 0,
  });

  // ── Form state ─────────────────────────────────────────────────────────

  // Left column
  const [title, setTitle] = React.useState("");
  const [severityOverride, setSeverityOverride] = React.useState("");
  const [cvssOverrideEnabled, setCvssOverrideEnabled] = React.useState(false);
  const [cvssOverride, setCvssOverride] = React.useState("");

  // Right column
  const [summary, setSummary] = React.useState("");
  const [observation, setObservation] = React.useState("");
  const [recommendation, setRecommendation] = React.useState("");
  const [remSteps, setRemSteps] = React.useState("");
  const [remEnabled, setRemEnabled] = React.useState(true);

  // Override justification (shown when needed)
  const [justification, setJustification] = React.useState("");

  // References
  const [refs, setRefs] = React.useState<Record<RefType, RefState>>(buildEmptyRefs);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ── Sync from fetched finding ──────────────────────────────────────────

  React.useEffect(() => {
    if (!finding) return;
    setTitle(finding.title);
    setSeverityOverride(finding.severity_override ?? "");
    setCvssOverrideEnabled(finding.cvss_score_override != null);
    setCvssOverride(finding.cvss_score_override?.toString() ?? "");
    setSummary(finding.summary);
    setObservation(finding.observation);
    setRecommendation(finding.recommendation);
    setRemSteps(finding.remediation_steps);
    setRemEnabled(finding.remediation_steps_enabled);
    setJustification(finding.override_justification ?? "");

    // Build refs state from finding
    const newRefs = buildEmptyRefs();
    for (const { type, enabledKey } of REF_TYPES) {
      newRefs[type].enabled = Boolean((finding as unknown as Record<string, unknown>)[enabledKey]);
      newRefs[type].entries = finding.references
        .filter((r) => r.ref_type === type && r.is_visible)
        .map((r) => ({ identifier: r.identifier, url: r.url ?? "" }));
    }
    setRefs(newRefs);
    setError(null);
  }, [finding]);

  // Reset on close
  React.useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setSeverityOverride("");
      setCvssOverrideEnabled(false);
      setCvssOverride("");
      setSummary("");
      setObservation("");
      setRecommendation("");
      setRemSteps("");
      setRemEnabled(true);
      setJustification("");
      setRefs(buildEmptyRefs());
      setError(null);
    }
  }, [isOpen]);

  // ── Ref helpers ────────────────────────────────────────────────────────

  const updateRefEnabled = (type: RefType, enabled: boolean) =>
    setRefs((prev) => ({ ...prev, [type]: { ...prev[type], enabled } }));

  const addRefEntry = (type: RefType) =>
    setRefs((prev) => ({
      ...prev,
      [type]: { ...prev[type], entries: [...prev[type].entries, { identifier: "", url: "" }] },
    }));

  const removeRefEntry = (type: RefType, idx: number) =>
    setRefs((prev) => ({
      ...prev,
      [type]: { ...prev[type], entries: prev[type].entries.filter((_, i) => i !== idx) },
    }));

  const updateRefEntry = (type: RefType, idx: number, field: "identifier" | "url", val: string) =>
    setRefs((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        entries: prev[type].entries.map((e, i) => (i === idx ? { ...e, [field]: val } : e)),
      },
    }));

  // ── Validation ─────────────────────────────────────────────────────────

  const needsJustification =
    severityOverride !== "" || (finding?.is_placement_override ?? false);
  const justificationValid =
    !needsJustification || justification.trim().length >= MIN_JUSTIFICATION_LEN;
  const canSave = title.trim().length > 0 && summary.trim().length > 0 && justificationValid && !saving;

  // ── Save ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!finding) return;
    setSaving(true);
    setError(null);
    try {
      const newSeverity = severityOverride === "" ? null : (severityOverride as Severity);

      await updateFinding(findingId, {
        title: title.trim(),
        summary: summary.trim(),
        observation: observation.trim(),
        recommendation: recommendation.trim(),
        remediation_steps: remSteps.trim(),
        remediation_steps_enabled: remEnabled,
        cvss_score_override: cvssOverrideEnabled && cvssOverride !== "" ? parseFloat(cvssOverride) : undefined,
        severity_override: newSeverity ?? undefined,
        override_justification: needsJustification ? justification : undefined,
        ref_cve_enabled:          refs.cve.enabled,
        ref_cwe_enabled:          refs.cwe.enabled,
        ref_cisa_enabled:         refs.cisa.enabled,
        ref_nist_enabled:         refs.nist.enabled,
        ref_nvd_enabled:          refs.nvd.enabled,
        ref_manufacturer_enabled: refs.manufacturer.enabled,
      });

      // Atomically replace references
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
      await replaceFindingReferences(findingId, refPayload);

      toast.success("Finding updated");
      onSave();
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Finding"
      width="min(90vw, 920px)"
      footer={
        <>
          {error && (
            <span style={{ fontSize: 13, color: "var(--color-danger)", marginRight: "auto" }}>
              {error}
            </span>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={!canSave}>
            Save Changes
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <Spinner size={28} />
        </div>
      ) : !finding ? (
        <p style={{ color: "var(--color-danger)", fontSize: 14 }}>Failed to load finding.</p>
      ) : (
        <>
          {/* Two-column grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              marginBottom: 24,
            }}
          >
            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Input
                label="Title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              {/* Severity section */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={labelStyle}>Severity</label>
                  <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>Default:</span>
                  <SeverityBadge severity={finding.severity_default} />
                </div>
                <Select
                  label="Severity Override"
                  value={severityOverride}
                  onChange={(e) => setSeverityOverride(e.target.value)}
                  options={SEVERITY_OVERRIDE_OPTIONS}
                />
                {severityOverride !== "" && severityOverride !== finding.severity_default && (
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
                    <label style={labelStyle}>CVSS Score Override</label>
                    {finding.cvss_score_default != null && (
                      <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>
                        Default: {finding.cvss_score_default.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <Toggle
                    checked={cvssOverrideEnabled}
                    onChange={(val) => {
                      setCvssOverrideEnabled(val);
                      if (!val) setCvssOverride("");
                    }}
                    label={cvssOverrideEnabled ? "Enabled" : "Disabled"}
                  />
                </div>
                {cvssOverrideEnabled && (
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={cvssOverride}
                    onChange={(e) => setCvssOverride(e.target.value)}
                    hint="0.0 – 10.0"
                  />
                )}
              </div>

              {/* Override Justification (only when needed) */}
              {needsJustification && (
                <div>
                  <Textarea
                    label="Override Justification"
                    required
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Explain why severity is overridden or finding is in a mismatched section (min 20 chars)…"
                    style={{ minHeight: 80 }}
                    hint={`${justification.trim().length} / ${MIN_JUSTIFICATION_LEN} min characters`}
                    error={
                      justification.trim().length > 0 &&
                      justification.trim().length < MIN_JUSTIFICATION_LEN
                        ? `At least ${MIN_JUSTIFICATION_LEN} characters required`
                        : undefined
                    }
                  />
                  {finding.is_placement_override && !finding.override_justification && (
                    <p style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 4 }}>
                      Required: this finding is placed in a mismatched severity section.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Textarea
                label="Summary"
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                style={{ minHeight: 80 }}
              />
              <Textarea
                label="Observation"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                style={{ minHeight: 80 }}
              />
              <Textarea
                label="Recommendation"
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                style={{ minHeight: 80 }}
              />
              <Textarea
                label="Remediation Steps"
                value={remSteps}
                onChange={(e) => setRemSteps(e.target.value)}
                style={{ minHeight: 80 }}
              />
              <div>
                <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>
                  Remediation Steps Enabled
                </label>
                <Toggle
                  checked={remEnabled}
                  onChange={setRemEnabled}
                  label={remEnabled ? "Enabled" : "Disabled"}
                />
              </div>
            </div>
          </div>

          {/* References section */}
          <div style={{ borderTop: "1px solid var(--color-gray-200)", paddingTop: 20 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-gray-700)",
                marginBottom: 16,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              References
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {REF_TYPES.map(({ type, label }) => {
                const state = refs[type];
                return (
                  <div
                    key={type}
                    style={{
                      border: "1px solid var(--color-gray-200)",
                      borderRadius: "var(--radius-md)",
                      padding: "12px 14px",
                      opacity: state.enabled ? 1 : 0.55,
                    }}
                  >
                    {/* Header row */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: state.enabled ? 12 : 0,
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
        </>
      )}
    </Modal>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildEmptyRefs(): Record<RefType, RefState> {
  const result = {} as Record<RefType, RefState>;
  for (const { type } of REF_TYPES) {
    result[type] = { enabled: false, entries: [] };
  }
  return result;
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-gray-700)",
};
