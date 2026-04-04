/**
 * ReportFormModal — create or edit a report.
 *
 * Used from two places:
 *   - Reports page ("+ New Report" button) — no pre-filled engagement
 *   - Engagements page expanded row — engagement pre-filled via engagementId prop
 *
 * The customer (client) dropdown drives the engagement dropdown — selecting a
 * customer filters the engagements list to only that client's engagements.
 * Engagement is optional; a report can be saved unlinked and linked later.
 *
 * On successful create, the user is navigated directly to the Report Builder.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { createReport, updateReport } from "../../api/reports";
import { getClients } from "../../api/clients";
import { getEngagements } from "../../api/engagements";
import { useToast } from "../ui/useToast";
import type { Report, Client, Engagement, EngagementType } from "../../types/models";

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "editing", label: "Editing" },
  { value: "final_review", label: "Final Review" },
  { value: "complete", label: "Complete" },
];

const TYPE_OPTIONS: { value: EngagementType; label: string }[] = [
  { value: "pentest", label: "Pentest" },
  { value: "gap_assessment", label: "Gap Assessment" },
  { value: "vulnerability_assessment", label: "Vulnerability Assessment" },
  { value: "tabletop", label: "Tabletop Exercise" },
  { value: "tsa_directive", label: "TSA Directive" },
  { value: "compliance_assessment", label: "Compliance Assessment" },
];

// ── Props ─────────────────────────────────────────────────────────────────

interface ReportFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pass report to open in edit mode; undefined = create mode */
  report?: Report;
  /** Pre-fill engagement when creating from Engagements page (optional) */
  engagementId?: string;
  onSuccess: (report: Report) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function ReportFormModal({
  isOpen,
  onClose,
  report,
  engagementId,
  onSuccess,
}: ReportFormModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEdit = !!report;

  // Form field state
  const [title, setTitle] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [selectedEngagementId, setSelectedEngagementId] = React.useState("");
  const [selectedType, setSelectedType] = React.useState<EngagementType | "">("");
  const [selectedStatus, setSelectedStatus] = React.useState("draft");
  const [startDate, setStartDate] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // Fetch clients and engagements for dropdowns — only when modal is open
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients,
    staleTime: 120_000,
    enabled: isOpen,
  });

  const { data: allEngagements = [] } = useQuery({
    queryKey: ["engagements"],
    queryFn: () => getEngagements(),
    staleTime: 120_000,
    enabled: isOpen,
  });

  // Only show engagements belonging to the currently selected customer
  const clientEngagements = React.useMemo(() => {
    if (!clientId) return allEngagements;
    return allEngagements.filter((e) => e.client_id === clientId);
  }, [allEngagements, clientId]);

  // Populate fields when the modal opens (handles both create and edit modes)
  React.useEffect(() => {
    if (!isOpen) return;

    if (isEdit && report) {
      // Edit mode — fill fields from the existing report
      setTitle(report.title);
      setSelectedStatus(report.status);
      setSelectedType((report.types?.[0] as EngagementType) ?? "");
      setStartDate(report.start_date ?? "");
      setDueDate(report.due_date ?? "");
      setSelectedEngagementId(report.engagement_id ?? "");
      // Resolve the client from the linked engagement so the customer dropdown is set
      const eng = allEngagements.find((e) => e.id === report.engagement_id);
      setClientId(eng?.client_id ?? "");
    } else {
      // Create mode — reset to defaults, optionally pre-fill engagement
      setTitle("");
      setClientId("");
      setSelectedEngagementId(engagementId ?? "");
      setSelectedType("");
      setSelectedStatus("draft");
      setStartDate("");
      setDueDate("");
      // If an engagement was pre-filled, also pre-fill the customer
      if (engagementId) {
        const eng = allEngagements.find((e) => e.id === engagementId);
        if (eng) setClientId(eng.client_id);
      }
    }
    setError(null);
    setFieldErrors({});
  }, [isOpen, isEdit, report, engagementId, allEngagements]);

  // When customer changes, clear the engagement if it no longer belongs to that customer
  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
    const engStillValid = allEngagements.find(
      (e) => e.id === selectedEngagementId && e.client_id === newClientId
    );
    if (!engStillValid) setSelectedEngagementId("");
  };

  // Only report name is required — engagement is optional
  const isValid = title.trim();

  const setFieldError = (field: string, msg: string) =>
    setFieldErrors((prev) => {
      if (!msg) { const n = { ...prev }; delete n[field]; return n; }
      return { ...prev, [field]: msg };
    });

  const validateAll = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Report name is required";
    if (startDate && dueDate && dueDate < startDate) errs.dueDate = "Due date must be after start date";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateAll()) return;
    setError(null);
    setSaving(true);
    try {
      const payload = {
        engagement_id: selectedEngagementId || null,
        title: title.trim(),
        status: selectedStatus,
        types: selectedType ? [selectedType] : [],
        start_date: startDate || null,
        due_date: dueDate || null,
      };

      let saved: Report;
      if (isEdit && report) {
        saved = await updateReport(report.id, payload);
        toast.success("Report updated");
      } else {
        saved = await createReport(payload);
        toast.success("Report created");
      }

      // Refresh any cached report lists that may be affected
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["reports", "by-engagement", selectedEngagementId] });
      onSuccess(saved);
      onClose();

      // On create, send the user straight to the Report Builder
      if (!isEdit) {
        navigate(`/reports/${saved.id}/build`);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : `Failed to ${isEdit ? "update" : "create"} report.`);
    } finally {
      setSaving(false);
    }
  };

  // Build dropdown option lists
  const clientOptions = [
    { value: "", label: "Select a customer…" },
    ...clients.map((c: Client) => ({ value: c.id, label: c.name })),
  ];

  const engagementOptions = [
    // If a customer is selected, allow saving without an engagement
    { value: "", label: clientId ? "No engagement (unlinked)" : "Select a customer first…" },
    ...clientEngagements.map((e: Engagement) => ({ value: e.id, label: e.title })),
  ];

  const typeOptions = [
    { value: "", label: "Select a type…" },
    ...TYPE_OPTIONS,
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Report" : "New Report"}
      width="min(90vw, 520px)"
      footer={
        <>
          {error && (
            <span style={{ fontSize: 13, color: "var(--color-danger)", marginRight: "auto" }}>
              {error}
            </span>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={!isValid}>
            {isEdit ? "Save Changes" : "Create"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input
          label="Report Name"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setFieldError("title", title.trim() ? "" : "Report name is required")}
          error={fieldErrors.title}
          placeholder="e.g. Q2 2026 Pentest Report"
        />

        {/* Customer selection drives the Engagement dropdown */}
        <Select
          label="Customer"
          required
          value={clientId}
          onChange={(e) => handleClientChange(e.target.value)}
          options={clientOptions}
        />

        {/* Disabled until a customer is selected */}
        <Select
          label="Engagement"
          value={selectedEngagementId}
          onChange={(e) => setSelectedEngagementId(e.target.value)}
          options={engagementOptions}
          disabled={!clientId}
        />

        <Select
          label="Type"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as EngagementType | "")}
          options={typeOptions}
        />

        <Select
          label="Status"
          required
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          options={STATUS_OPTIONS}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setFieldError("dueDate", ""); }}
          />
          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            onBlur={() => setFieldError("dueDate", startDate && dueDate && dueDate < startDate ? "Due date must be after start date" : "")}
            error={fieldErrors.dueDate}
          />
        </div>
      </div>
    </Modal>
  );
}
