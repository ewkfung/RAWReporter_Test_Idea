import React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { createEngagement, updateEngagement } from "../../api/engagements";
import { getClients } from "../../api/clients";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Engagement, EngagementStatus, EngagementType } from "../../types/models";

interface EngagementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  engagement?: Engagement;
  defaultClientId?: string;
  onSuccess: (engagement: Engagement) => void;
}

const TYPE_OPTIONS: Array<{ value: EngagementType; label: string }> = [
  { value: "pentest", label: "Pentest" },
  { value: "gap_assessment", label: "Gap Assessment" },
  { value: "vulnerability_assessment", label: "Vulnerability Assessment" },
  { value: "tabletop", label: "Tabletop Exercise" },
  { value: "tsa_directive", label: "TSA Directive" },
  { value: "compliance_assessment", label: "Compliance Assessment" },
];

const STATUS_OPTIONS = [
  { value: "scoping", label: "Scoping" },
  { value: "active", label: "Active" },
  { value: "in_review", label: "In Review" },
  { value: "delivered", label: "Delivered" },
  { value: "closed", label: "Closed" },
];

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-gray-700)",
  marginBottom: 6,
  display: "block",
};

export function EngagementFormModal({
  isOpen,
  onClose,
  engagement,
  defaultClientId,
  onSuccess,
}: EngagementFormModalProps) {
  const isEdit = engagement !== undefined;
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients,
    staleTime: 120_000,
    enabled: isOpen,
  });

  const [title, setTitle] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [selectedTypes, setSelectedTypes] = React.useState<EngagementType[]>([]);
  const [status, setStatus] = React.useState<EngagementStatus>("scoping");
  const [lead, setLead] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [scopeDescription, setScopeDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const setFieldError = (field: string, msg: string) =>
    setFieldErrors((prev) => {
      if (!msg) { const n = { ...prev }; delete n[field]; return n; }
      return { ...prev, [field]: msg };
    });

  React.useEffect(() => {
    if (isOpen) {
      setTitle(engagement?.title ?? "");
      setClientId(engagement?.client_id ?? defaultClientId ?? "");
      setSelectedTypes(engagement?.types ?? []);
      setStatus(engagement?.status ?? "scoping");
      setLead(engagement?.engagement_lead ?? "");
      setStartDate(engagement?.start_date?.slice(0, 10) ?? "");
      setEndDate(engagement?.end_date?.slice(0, 10) ?? "");
      setScopeDescription(engagement?.scope_description ?? "");
      setError(null);
      setFieldErrors({});
    }
  }, [isOpen, engagement, defaultClientId]);

  const toggleType = (t: EngagementType) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));
  const canSave = title.trim() && clientId && selectedTypes.length > 0 && status;

  const validateAll = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required";
    if (!clientId) errs.clientId = "Select a client";
    if (startDate && endDate && endDate < startDate) errs.endDate = "End date must be after start date";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateAll()) return;
    setError(null);
    setSaving(true);
    try {
      const payload = {
        client_id: clientId,
        title: title.trim(),
        types: selectedTypes,
        status,
        engagement_lead: lead.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        scope_description: scopeDescription.trim() || null,
      };
      const saved = isEdit
        ? await updateEngagement(engagement.id, payload)
        : await createEngagement(payload as Omit<Engagement, "id" | "created_at" | "updated_at" | "is_archived" | "archived_at">);
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
      onSuccess(saved);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to save engagement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Engagement" : "New Engagement"}
      width="min(90vw, 580px)"
      footer={
        <>
          {error && (
            <span style={{ fontSize: 13, color: "var(--color-danger)", marginRight: "auto" }}>
              {error}
            </span>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={!canSave}>
            {isEdit ? "Save Changes" : "Create Engagement"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Title first */}
        <Input
          label="Engagement Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setFieldError("title", title.trim() ? "" : "Title is required")}
          error={fieldErrors.title}
        />

        {/* Client second */}
        <Select
          label="Client"
          required
          placeholder="Select a client…"
          value={clientId}
          onChange={(e) => { setClientId(e.target.value); setFieldError("clientId", e.target.value ? "" : "Select a client"); }}
          error={fieldErrors.clientId}
          options={clientOptions}
        />

        {/* Engagement Type — multi-select checkboxes */}
        <div>
          <label style={labelStyle}>
            Engagement Type <span style={{ color: "var(--color-danger)" }}>*</span>
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px 16px",
              padding: "12px 14px",
              border: "1px solid var(--color-gray-200)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-gray-50)",
            }}
          >
            {TYPE_OPTIONS.map((opt) => {
              const checked = selectedTypes.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    color: checked ? "var(--color-gray-900)" : "var(--color-gray-600)",
                    fontWeight: checked ? 600 : 400,
                    userSelect: "none",
                    padding: "4px 0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleType(opt.value)}
                    style={{ width: 15, height: 15, accentColor: "var(--color-primary)", cursor: "pointer" }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
          {selectedTypes.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 4, display: "block" }}>
              Select at least one type.
            </span>
          )}
        </div>

        {/* Status */}
        <Select
          label="Status"
          required
          value={status}
          onChange={(e) => setStatus(e.target.value as EngagementStatus)}
          options={STATUS_OPTIONS}
        />

        {/* Lead + Dates */}
        <Input
          label="Engagement Lead"
          value={lead}
          onChange={(e) => setLead(e.target.value)}
          placeholder="Lead consultant name"
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setFieldError("endDate", ""); }}
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onBlur={() => setFieldError("endDate", startDate && endDate && endDate < startDate ? "End date must be after start date" : "")}
            error={fieldErrors.endDate}
          />
        </div>

        {/* Engagement Details (was Scope Description) */}
        <Textarea
          label="Engagement Details"
          value={scopeDescription}
          onChange={(e) => setScopeDescription(e.target.value)}
          placeholder="Describe the scope and details of this engagement…"
        />
      </div>
    </Modal>
  );
}
