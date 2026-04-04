import React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { createClient, updateClient } from "../../api/clients";
import { useQueryClient } from "@tanstack/react-query";
import type { Client, AdditionalContact, ClientStatus } from "../../types/models";

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client;
  onSuccess: (client: Client) => void;
}

const CLIENT_STATUS_OPTIONS: Array<{ value: ClientStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "inactive", label: "Inactive" },
  { value: "to_be_archived", label: "To Be Archived" },
];

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 14,
  border: "1px solid var(--color-gray-300)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-white)",
  color: "var(--color-gray-900)",
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-gray-700)",
  marginBottom: 4,
};

export function ClientFormModal({ isOpen, onClose, client, onSuccess }: ClientFormModalProps) {
  const isEdit = client !== undefined;
  const queryClient = useQueryClient();

  const [name, setName] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [industryVertical, setIndustryVertical] = React.useState("");
  const [companyAddress, setCompanyAddress] = React.useState("");
  const [clientStatus, setClientStatus] = React.useState<ClientStatus>("active");
  const [primaryContact, setPrimaryContact] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [additionalContacts, setAdditionalContacts] = React.useState<AdditionalContact[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const setFieldError = (field: string, msg: string) =>
    setFieldErrors((prev) => {
      if (!msg) { const n = { ...prev }; delete n[field]; return n; }
      return { ...prev, [field]: msg };
    });

  const validateEmail = (v: string) =>
    v.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
      ? "Please enter a valid email address"
      : "";

  React.useEffect(() => {
    if (isOpen) {
      setName(client?.name ?? "");
      setCompanyName(client?.company_name ?? "");
      setIndustryVertical(client?.industry_vertical ?? "");
      setCompanyAddress(client?.company_address ?? "");
      setClientStatus(client?.client_status ?? "active");
      setPrimaryContact(client?.primary_contact ?? "");
      setContactEmail(client?.contact_email ?? "");
      setAdditionalContacts(client?.additional_contacts ? [...client.additional_contacts] : []);
      setError(null);
      setFieldErrors({});
    }
  }, [isOpen, client]);

  const addContact = () =>
    setAdditionalContacts((prev) => [...prev, { name: "", email: "" }]);

  const updateContact = (idx: number, field: keyof AdditionalContact, value: string) =>
    setAdditionalContacts((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );

  const removeContact = (idx: number) =>
    setAdditionalContacts((prev) => prev.filter((_, i) => i !== idx));

  const canSave = name.trim();

  const validateAll = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Client name is required";
    const emailErr = validateEmail(contactEmail);
    if (emailErr) errs.contactEmail = emailErr;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateAll()) return;
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        company_name: companyName.trim(),
        industry_vertical: industryVertical.trim(),
        company_address: companyAddress.trim(),
        client_status: clientStatus,
        primary_contact: primaryContact.trim(),
        contact_email: contactEmail.trim(),
        additional_contacts: additionalContacts.map((c) => ({
          name: c.name.trim(),
          email: c.email.trim(),
        })),
      };
      const saved = isEdit
        ? await updateClient(client.id, payload)
        : await createClient(payload);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onSuccess(saved);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to save client.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Client" : "New Client"}
      width="min(90vw, 560px)"
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
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={!canSave}>
            {isEdit ? "Save Changes" : "Create Client"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Client Name */}
        <Input
          label="Client Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setFieldError("name", name.trim() ? "" : "Client name is required")}
          error={fieldErrors.name}
        />

        {/* Company Name */}
        <Input
          label="Company Name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Full legal company name"
        />

        {/* Industry Vertical */}
        <Input
          label="Industry Vertical"
          value={industryVertical}
          onChange={(e) => setIndustryVertical(e.target.value)}
          placeholder="e.g. Oil & Gas, Water, Manufacturing"
        />

        {/* Company Address */}
        <div>
          <label style={labelStyle}>Company Address</label>
          <textarea
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            rows={2}
            placeholder="Street, City, State, ZIP"
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 14,
              border: "1px solid var(--color-gray-300)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-white)",
              color: "var(--color-gray-900)",
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Client Status */}
        <div>
          <label style={labelStyle}>Client Status</label>
          <select
            value={clientStatus}
            onChange={(e) => setClientStatus(e.target.value as ClientStatus)}
            style={selectStyle}
          >
            {CLIENT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--color-gray-100)" }} />

        {/* Primary Contact */}
        <Input
          label="Primary Contact"
          value={primaryContact}
          onChange={(e) => setPrimaryContact(e.target.value)}
        />
        <Input
          label="Contact Email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          onBlur={() => setFieldError("contactEmail", validateEmail(contactEmail))}
          error={fieldErrors.contactEmail}
        />

        {/* Additional Contacts */}
        {additionalContacts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {additionalContacts.map((contact, idx) => (
              <div
                key={idx}
                style={{
                  border: "1px solid var(--color-gray-200)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Additional Contact {idx + 1}
                  </span>
                  <button
                    onClick={() => removeContact(idx)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--color-danger)",
                      padding: "0 2px",
                      lineHeight: 1,
                    }}
                  >
                    Remove
                  </button>
                </div>
                <Input
                  label="Contact Name"
                  value={contact.name}
                  onChange={(e) => updateContact(idx, "name", e.target.value)}
                />
                <Input
                  label="Contact Email"
                  type="email"
                  value={contact.email}
                  onChange={(e) => updateContact(idx, "email", e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addContact}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-primary)",
            background: "none",
            border: "1px dashed var(--color-primary)",
            borderRadius: "var(--radius-sm)",
            padding: "6px 12px",
            cursor: "pointer",
            width: "fit-content",
          }}
        >
          + Add Additional Contact
        </button>
      </div>
    </Modal>
  );
}
