import React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { Spinner } from "../ui/Spinner";
import { createEngagement, updateEngagement } from "../../api/engagements";
import { getClients } from "../../api/clients";
import { listUsers } from "../../api/users";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Engagement, EngagementStatus, EngagementType } from "../../types/models";
import type { UserWithRoles } from "../../api/users";

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
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-gray-700)",
  marginBottom: 6,
  display: "block",
};

// ── User Picker Modal ──────────────────────────────────────────────────────
// A lightweight inline modal for selecting a single user from the users list.

function UserPickerModal({
  isOpen,
  title,
  excludeIds,
  users,
  isLoading,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  excludeIds: string[];
  users: UserWithRoles[];
  isLoading: boolean;
  onSelect: (user: UserWithRoles) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (isOpen) setSearch("");
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = users
    .filter((u) => !excludeIds.includes(u.id))
    .filter((u) => {
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        (u.first_name ?? "").toLowerCase().includes(q) ||
        (u.last_name ?? "").toLowerCase().includes(q)
      );
    });

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--color-white)", borderRadius: "var(--radius-md)", padding: 20, width: "min(90vw, 400px)", boxShadow: "var(--shadow-xl)", display: "flex", flexDirection: "column", maxHeight: "70vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>{title}</h3>
        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            fontSize: 13, padding: "7px 10px", marginBottom: 10,
            border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)",
            outline: "none", width: "100%", boxSizing: "border-box",
          }}
          autoFocus
        />
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)" }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 20 }}><Spinner size={18} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", fontSize: 13, color: "var(--color-gray-400)" }}>
              No users found
            </div>
          ) : (
            filtered.map((u) => {
              const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ");
              return (
                <button
                  key={u.id}
                  onClick={() => { onSelect(u); onClose(); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "10px 14px", background: "none", border: "none",
                    borderBottom: "1px solid var(--color-gray-100)",
                    cursor: "pointer", fontSize: 13,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ fontWeight: 600, color: "var(--color-gray-900)" }}>{u.username}</span>
                  {fullName && (
                    <span style={{ marginLeft: 6, color: "var(--color-gray-500)" }}>{fullName}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ── UserChip ───────────────────────────────────────────────────────────────

function UserChip({ username, onRemove }: { username: string; onRemove: () => void }) {
  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 999,
        background: "var(--color-gray-100)",
        border: "1px solid var(--color-gray-200)",
        fontSize: 13, fontWeight: 500, color: "var(--color-gray-800)",
      }}
    >
      {username}
      <button
        type="button"
        onClick={onRemove}
        style={{
          background: "none", border: "none", cursor: "pointer",
          padding: 0, display: "flex", alignItems: "center",
          color: "var(--color-gray-400)", lineHeight: 1,
        }}
        title="Remove"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

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

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    staleTime: 120_000,
    enabled: isOpen,
  });

  const [title, setTitle] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [selectedTypes, setSelectedTypes] = React.useState<EngagementType[]>([]);
  const [status, setStatus] = React.useState<EngagementStatus>("scoping");
  const [leadId, setLeadId] = React.useState<string | null>(null);
  const [consultantIds, setConsultantIds] = React.useState<string[]>([]);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [completedDate, setCompletedDate] = React.useState("");
  const [scopeDescription, setScopeDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [leadPickerOpen, setLeadPickerOpen] = React.useState(false);
  const [consultantPickerOpen, setConsultantPickerOpen] = React.useState(false);

  const userMap = React.useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users]
  );

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
      setLeadId(engagement?.engagement_lead_id ?? null);
      setConsultantIds(engagement?.consultant_ids ?? []);
      setStartDate(engagement?.start_date?.slice(0, 10) ?? "");
      setEndDate(engagement?.end_date?.slice(0, 10) ?? "");
      setCompletedDate(engagement?.completed_date?.slice(0, 10) ?? "");
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
        engagement_lead_id: leadId || null,
        consultant_ids: consultantIds,
        start_date: startDate || null,
        end_date: endDate || null,
        completed_date: completedDate || null,
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

  const leadUser = leadId ? userMap.get(leadId) : null;

  return (
    <>
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

          {/* Title */}
          <Input
            label="Engagement Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setFieldError("title", title.trim() ? "" : "Title is required")}
            error={fieldErrors.title}
          />

          {/* Client */}
          <Select
            label="Client"
            required
            placeholder="Select a client…"
            value={clientId}
            onChange={(e) => { setClientId(e.target.value); setFieldError("clientId", e.target.value ? "" : "Select a client"); }}
            error={fieldErrors.clientId}
            options={clientOptions}
          />

          {/* Engagement Type */}
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
            onChange={(e) => {
              const s = e.target.value as EngagementStatus;
              setStatus(s);
              if ((s === "completed" || s === "closed") && !completedDate) {
                setCompletedDate(new Date().toISOString().slice(0, 10));
              }
            }}
            options={STATUS_OPTIONS}
          />

          {/* Engagement Lead */}
          <div>
            <label style={labelStyle}>Engagement Lead</label>
            {leadUser ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserChip
                  username={leadUser.username}
                  onRemove={() => setLeadId(null)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLeadPickerOpen(true)}
                style={{
                  fontSize: 13, padding: "7px 12px",
                  border: "1px dashed var(--color-gray-300)",
                  borderRadius: "var(--radius-sm)",
                  background: "none", cursor: "pointer",
                  color: "var(--color-primary)", fontWeight: 500,
                }}
              >
                + Select Lead
              </button>
            )}
          </div>

          {/* Consultants */}
          <div>
            <label style={labelStyle}>Consultants</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: consultantIds.length > 0 ? 8 : 0 }}>
              {consultantIds.map((id) => {
                const u = userMap.get(id);
                return (
                  <UserChip
                    key={id}
                    username={u?.username ?? id.slice(0, 8) + "…"}
                    onRemove={() => setConsultantIds((prev) => prev.filter((x) => x !== id))}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setConsultantPickerOpen(true)}
              style={{
                fontSize: 13, padding: "7px 12px",
                border: "1px dashed var(--color-gray-300)",
                borderRadius: "var(--radius-sm)",
                background: "none", cursor: "pointer",
                color: "var(--color-primary)", fontWeight: 500,
              }}
            >
              + Add User
            </button>
          </div>

          {/* Dates */}
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
          <Input
            label="Completed Date"
            type="date"
            value={completedDate}
            onChange={(e) => setCompletedDate(e.target.value)}
          />

          {/* Engagement Details */}
          <Textarea
            label="Engagement Details"
            value={scopeDescription}
            onChange={(e) => setScopeDescription(e.target.value)}
            placeholder="Describe the scope and details of this engagement…"
          />
        </div>
      </Modal>

      {/* Lead picker — rendered outside Modal to avoid z-index stacking issues */}
      <UserPickerModal
        isOpen={leadPickerOpen}
        title="Select Engagement Lead"
        excludeIds={leadId ? [leadId] : []}
        users={users}
        isLoading={usersLoading}
        onSelect={(u) => setLeadId(u.id)}
        onClose={() => setLeadPickerOpen(false)}
      />

      {/* Consultant picker */}
      <UserPickerModal
        isOpen={consultantPickerOpen}
        title="Add Consultant"
        excludeIds={consultantIds}
        users={users}
        isLoading={usersLoading}
        onSelect={(u) => setConsultantIds((prev) => [...prev, u.id])}
        onClose={() => setConsultantPickerOpen(false)}
      />
    </>
  );
}
