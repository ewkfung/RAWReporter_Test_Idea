import React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import { Toggle } from "../ui/Toggle";
import { ConfirmModal } from "../ui/ConfirmModal";
import {
  createLibraryFinding,
  updateLibraryFinding,
  replaceLibraryFindingReferences,
  type RefUpsert,
} from "../../api/library";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import type { LibraryFinding } from "../../types/models";

// ── Types ──────────────────────────────────────────────────────────────────

type RefType = "cve" | "cwe" | "cisa" | "nist" | "nvd" | "manufacturer";

interface RefEntry {
  identifier: string;
  url: string;
}

interface RefState {
  enabled: boolean;
  entries: RefEntry[];
}

const REF_TYPES: Array<{ type: RefType; label: string; enabledKey: keyof LibraryFinding }> = [
  { type: "cve",          label: "CVE",          enabledKey: "ref_cve_enabled" },
  { type: "cwe",          label: "CWE",          enabledKey: "ref_cwe_enabled" },
  { type: "cisa",         label: "CISA",         enabledKey: "ref_cisa_enabled" },
  { type: "nist",         label: "NIST",         enabledKey: "ref_nist_enabled" },
  { type: "nvd",          label: "NVD",          enabledKey: "ref_nvd_enabled" },
  { type: "manufacturer", label: "Manufacturer", enabledKey: "ref_manufacturer_enabled" },
];

const SEVERITY_OPTIONS = [
  { value: "critical",      label: "Critical" },
  { value: "high",          label: "High" },
  { value: "medium",        label: "Medium" },
  { value: "low",           label: "Low" },
  { value: "informational", label: "Informational" },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface LibraryFindingFormModalProps {
  isOpen: boolean;
  finding: LibraryFinding | null;
  onClose: () => void;
  onSaved: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function initRefs(finding: LibraryFinding | null): Record<RefType, RefState> {
  const init = (type: RefType, enabledKey: keyof LibraryFinding): RefState => {
    const enabled = finding ? Boolean(finding[enabledKey]) : false;
    const entries: RefEntry[] = finding
      ? finding.references
          .filter((r) => r.ref_type === type && r.is_visible)
          .map((r) => ({ identifier: r.identifier, url: r.url ?? "" }))
      : [];
    return { enabled, entries };
  };
  return Object.fromEntries(
    REF_TYPES.map(({ type, enabledKey }) => [type, init(type, enabledKey)])
  ) as Record<RefType, RefState>;
}

// ── Main component ─────────────────────────────────────────────────────────

export function LibraryFindingFormModal({
  isOpen,
  finding,
  onClose,
  onSaved,
}: LibraryFindingFormModalProps) {
  const isEdit = finding !== null;

  // Left-column state
  const [title, setTitle] = React.useState(finding?.title ?? "");
  const [severity, setSeverity] = React.useState<LibraryFinding["severity"]>(
    finding?.severity ?? "critical"
  );
  const [cvssEnabled, setCvssEnabled] = React.useState(
    finding?.cvss_score_default != null
  );
  const [cvss, setCvss] = React.useState(finding?.cvss_score_default?.toString() ?? "");
  const [tags, setTags] = React.useState<string[]>(finding?.tags ?? []);

  // Right-column state
  const [summary, setSummary] = React.useState(finding?.summary ?? "");
  const [observation, setObservation] = React.useState(finding?.observation ?? "");
  const [recommendation, setRecommendation] = React.useState(finding?.recommendation ?? "");
  const [remSteps, setRemSteps] = React.useState(finding?.remediation_steps ?? "");
  const [remEnabled, setRemEnabled] = React.useState(finding?.remediation_steps_enabled ?? true);

  // References state
  const [refs, setRefs] = React.useState<Record<RefType, RefState>>(() => initRefs(finding));

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = React.useState(false);
  const markDirty = React.useCallback(() => setHasChanges(true), []);
  const { blocker } = useUnsavedChanges(isOpen && hasChanges);

  // Reset dirty flag each time the modal opens
  React.useEffect(() => {
    if (isOpen) setHasChanges(false);
  }, [isOpen]);

  const setFieldError = (field: string, msg: string) =>
    setFieldErrors((prev) => {
      if (!msg) { const n = { ...prev }; delete n[field]; return n; }
      return { ...prev, [field]: msg };
    });

  const canSave = title.trim().length > 0 && summary.trim().length > 0;

  const validateAll = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required";
    if (!summary.trim()) errs.summary = "Summary is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const updateRefEnabled = (type: RefType, enabled: boolean) => {
    markDirty();
    setRefs((prev) => ({ ...prev, [type]: { ...prev[type], enabled } }));
  };

  const updateRefEntries = (type: RefType, entries: RefEntry[]) => {
    markDirty();
    setRefs((prev) => ({ ...prev, [type]: { ...prev[type], entries } }));
  };

  const addRefEntry = (type: RefType) =>
    updateRefEntries(type, [...refs[type].entries, { identifier: "", url: "" }]);

  const removeRefEntry = (type: RefType, idx: number) =>
    updateRefEntries(
      type,
      refs[type].entries.filter((_, i) => i !== idx)
    );

  const updateRefEntry = (type: RefType, idx: number, field: "identifier" | "url", val: string) =>
    updateRefEntries(
      type,
      refs[type].entries.map((e, i) => (i === idx ? { ...e, [field]: val } : e))
    );

  const handleSave = async () => {
    if (!validateAll()) return;
    setError(null);
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        severity,
        cvss_score_default: cvssEnabled && cvss !== "" ? parseFloat(cvss) : null,
        tags,
        summary: summary.trim(),
        observation: observation.trim(),
        recommendation: recommendation.trim(),
        remediation_steps: remSteps.trim(),
        remediation_steps_enabled: remEnabled,
        // Preserved fields — not shown in form but kept as defaults
        vertical: finding?.vertical ?? "",
        is_ot_specific: finding?.is_ot_specific ?? false,
        framework_refs: finding?.framework_refs ?? [],
        questionnaire_trigger: finding?.questionnaire_trigger ?? [],
        description_technical: finding?.description_technical ?? "",
        description_executive: finding?.description_executive ?? "",
        // Reference toggle flags
        ref_cve_enabled: refs.cve.enabled,
        ref_cwe_enabled: refs.cwe.enabled,
        ref_cisa_enabled: refs.cisa.enabled,
        ref_nist_enabled: refs.nist.enabled,
        ref_nvd_enabled: refs.nvd.enabled,
        ref_manufacturer_enabled: refs.manufacturer.enabled,
        is_archived: finding?.is_archived ?? false,
        archived_at: finding?.archived_at ?? null,
        archived_by: finding?.archived_by ?? null,
      };

      let savedId: string;
      if (isEdit) {
        const updated = await updateLibraryFinding(finding.id, payload);
        savedId = updated.id;
      } else {
        const created = await createLibraryFinding(payload);
        savedId = created.id;
      }

      // Replace all references atomically
      const refPayload: RefUpsert[] = REF_TYPES.flatMap(({ type }) => {
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
      await replaceLibraryFindingReferences(savedId, refPayload);

      onSaved();
    } catch (e: unknown) {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Library Finding" : "New Library Finding"}
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
            {isEdit ? "Save Changes" : "Create Finding"}
          </Button>
        </>
      }
    >
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
            onChange={(e) => { setTitle(e.target.value); markDirty(); }}
            onBlur={() => setFieldError("title", title.trim() ? "" : "Title is required")}
            error={fieldErrors.title}
          />
          <Select
            label="Severity"
            required
            options={SEVERITY_OPTIONS}
            value={severity}
            onChange={(e) => { setSeverity(e.target.value as LibraryFinding["severity"]); markDirty(); }}
          />
          {/* CVSS Score with enable toggle */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)" }}>
                CVSS Score
              </label>
              <Toggle
                checked={cvssEnabled}
                onChange={(val) => {
                  setCvssEnabled(val);
                  if (!val) setCvss("");
                  markDirty();
                }}
                label={cvssEnabled ? "Enabled" : "Disabled"}
              />
            </div>
            {cvssEnabled && (
              <Input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={cvss}
                onChange={(e) => { setCvss(e.target.value); markDirty(); }}
                hint="0.0 – 10.0"
              />
            )}
          </div>
          <TagInput label="Tags" values={tags} onChange={(vals) => { setTags(vals); markDirty(); }} />
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
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)", display: "block", marginBottom: 6 }}>
              Remediation Steps Enabled
            </label>
            <Toggle checked={remEnabled} onChange={(val) => { setRemEnabled(val); markDirty(); }} label={remEnabled ? "Enabled" : "Disabled"} />
          </div>
        </div>
      </div>

      {/* References section */}
      <div style={{ borderTop: "1px solid var(--color-gray-200)", paddingTop: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-gray-700)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          References
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: state.enabled ? 12 : 0 }}>
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
    </Modal>

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

// ── Tag input ──────────────────────────────────────────────────────────────

function TagInput({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (vals: string[]) => void;
}) {
  const [inputVal, setInputVal] = React.useState("");

  const addTags = (raw: string) => {
    const newOnes = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (newOnes.length) onChange([...values, ...newOnes]);
    setInputVal("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)" }}>
        {label}
      </label>
      <input
        value={inputVal}
        placeholder="Type and press Enter or comma…"
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTags(inputVal);
          }
        }}
        onBlur={() => inputVal.trim() && addTags(inputVal)}
        style={{
          height: 36,
          padding: "0 10px",
          fontSize: 13,
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-gray-300)",
          background: "var(--color-white)",
          outline: "none",
          width: "100%",
        }}
      />
      {values.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
          {values.map((v, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                background: "var(--color-gray-100)",
                borderRadius: 999,
                fontSize: 12,
                color: "var(--color-gray-700)",
              }}
            >
              {v}
              <button
                onClick={() => onChange(values.filter((_, j) => j !== i))}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: "var(--color-gray-400)",
                  fontSize: 12,
                  lineHeight: 1,
                  display: "flex",
                }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
