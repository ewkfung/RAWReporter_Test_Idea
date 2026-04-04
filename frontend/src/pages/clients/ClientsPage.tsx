import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { SkeletonTable } from "../../components/loading/SkeletonTable";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { ClientFormModal } from "../../components/clients/ClientFormModal";
import { usePermission } from "../../hooks/usePermission";
import { useToast } from "../../components/ui/useToast";
import { getClients, deleteClient, archiveClient } from "../../api/clients";
import { getEngagements } from "../../api/engagements";
import { formatDate } from "../../utils/formatting";
import type { Client, ClientStatus } from "../../types/models";
import type { BadgeVariant } from "../../components/ui/Badge";

// ── Status helpers ─────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ClientStatus, BadgeVariant> = {
  active: "success",
  on_hold: "warning",
  inactive: "neutral",
  to_be_archived: "critical",
};

const STATUS_LABEL: Record<ClientStatus, string> = {
  active: "Active",
  on_hold: "On Hold",
  inactive: "Inactive",
  to_be_archived: "To Be Archived",
};

// ── Manage dropdown ────────────────────────────────────────────────────────

function ManageDropdown({
  onEdit,
  onArchive,
  onDelete,
  canArchive,
  canDelete,
}: {
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  canArchive: boolean;
  canDelete: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "4px 10px",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--color-gray-600)",
          background: "var(--color-gray-50)",
          border: "1px solid var(--color-gray-200)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        Manage
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            background: "var(--color-white)",
            border: "1px solid var(--color-gray-200)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
            zIndex: 200,
            minWidth: 140,
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            style={menuItemStyle()}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            Edit
          </button>
          {canArchive && (
            <button
              onClick={() => { setOpen(false); onArchive(); }}
              style={menuItemStyle("var(--color-warning, #d97706)")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              Archive
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              style={menuItemStyle("var(--color-danger)")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-gray-50)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function menuItemStyle(color = "var(--color-gray-700)"): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 500,
    textAlign: "left",
    background: "none",
    border: "none",
    cursor: "pointer",
    color,
  };
}

// ── Expanded engagement list ───────────────────────────────────────────────

function ClientEngagements({
  clientId,
  onNewEngagement,
}: {
  clientId: string;
  onNewEngagement: (clientId: string) => void;
}) {
  const navigate = useNavigate();
  const canCreateEngagement = usePermission("engagement", "create");

  const { data: engagements, isLoading } = useQuery({
    queryKey: ["engagements", "by-client", clientId],
    queryFn: () => getEngagements(clientId),
    staleTime: 120_000,
  });

  const ENG_STATUS_BADGE: Record<string, string> = {
    scoping: "neutral", active: "success", in_review: "warning",
    delivered: "blue", closed: "neutral",
  };
  const ENG_STATUS_LABEL: Record<string, string> = {
    scoping: "Scoping", active: "Active", in_review: "In Review",
    delivered: "Delivered", closed: "Closed",
  };
  const TYPE_LABEL: Record<string, string> = {
    pentest: "Pentest", gap_assessment: "Gap Assessment",
    vulnerability_assessment: "Vuln Assessment", tabletop: "Tabletop",
    tsa_directive: "TSA Directive", compliance_assessment: "Compliance",
  };

  if (isLoading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}><Spinner size={20} /></div>;
  }

  return (
    <div>
      {engagements && engagements.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {engagements.map((eng) => (
            <div
              key={eng.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: "var(--color-white)",
                border: "1px solid var(--color-gray-200)",
                borderRadius: "var(--radius-sm)",
                flexWrap: "wrap",
              }}
            >
              <Badge variant={(ENG_STATUS_BADGE[eng.status] ?? "neutral") as BadgeVariant}>
                {ENG_STATUS_LABEL[eng.status] ?? eng.status}
              </Badge>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-gray-900)", minWidth: 0 }}>
                {eng.title}
              </span>
              {eng.types && eng.types.length > 0 && (
                <span style={{ fontSize: 11, color: "var(--color-gray-400)", background: "var(--color-gray-100)", padding: "2px 7px", borderRadius: 999 }}>
                  {eng.types.map((t) => TYPE_LABEL[t] ?? t).join(", ")}
                </span>
              )}
              {(eng.start_date || eng.end_date) && (
                <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
                  {eng.start_date ? new Date(eng.start_date).toLocaleDateString() : "—"}
                  {" – "}
                  {eng.end_date ? new Date(eng.end_date).toLocaleDateString() : "TBD"}
                </span>
              )}
              <button
                onClick={() => navigate(`/engagements?expand=${eng.id}`)}
                style={{
                  fontSize: 12, fontWeight: 500, color: "var(--color-primary)",
                  background: "none", border: "1px solid var(--color-primary)",
                  borderRadius: "var(--radius-sm)", padding: "2px 8px", cursor: "pointer",
                }}
              >
                Open
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--color-gray-400)", marginBottom: 10 }}>
          No engagements for this client yet.
          {canCreateEngagement && (
            <> <button onClick={() => onNewEngagement(clientId)} style={{ color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0 }}>
              + New Engagement
            </button></>
          )}
        </p>
      )}
      {canCreateEngagement && (
        <button
          onClick={() => onNewEngagement(clientId)}
          style={{
            fontSize: 12, fontWeight: 500, color: "var(--color-primary)",
            background: "none", border: "1px dashed var(--color-primary)",
            borderRadius: "var(--radius-sm)", padding: "5px 12px", cursor: "pointer",
          }}
        >
          + New Engagement
        </button>
      )}
    </div>
  );
}

// ── Client row ────────────────────────────────────────────────────────────

function ClientRow({
  client,
  isExpanded,
  onToggle,
  onEdit,
  onArchive,
  onDelete,
  onNewEngagement,
  canEdit,
  canArchive,
  canDelete,
}: {
  client: Client;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onNewEngagement: (clientId: string) => void;
  canEdit: boolean;
  canArchive: boolean;
  canDelete: boolean;
}) {
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: "var(--color-gray-500)",
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10,
  };

  const infoLabel: React.CSSProperties = {
    fontSize: 11, color: "var(--color-gray-400)", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.04em",
  };

  const infoValue: React.CSSProperties = {
    fontSize: 13, color: "var(--color-gray-700)", marginTop: 2,
  };

  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-200)",
        borderRadius: "var(--radius-md)",
        marginBottom: 8,
      }}
    >
      {/* Collapsed row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={onToggle}
      >
        <span
          style={{
            flexShrink: 0,
            color: "var(--color-gray-400)",
            transition: "transform 0.15s",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            display: "inline-flex",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>

        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "var(--color-gray-900)" }}>
          {client.name}
        </span>

        {client.industry_vertical && (
          <span style={{
            fontSize: 11, fontWeight: 500, color: "var(--color-gray-500)",
            background: "var(--color-gray-200)", padding: "2px 8px", borderRadius: 999,
          }}>
            {client.industry_vertical}
          </span>
        )}

        <Badge variant={STATUS_BADGE[client.client_status] ?? "neutral"}>
          {STATUS_LABEL[client.client_status] ?? client.client_status}
        </Badge>

        {canEdit && (
          <ManageDropdown
            onEdit={onEdit}
            onArchive={onArchive}
            onDelete={onDelete}
            canArchive={canArchive}
            canDelete={canDelete}
          />
        )}
      </div>

      {/* Expanded area */}
      {isExpanded && (
        <div style={{ borderTop: "1px solid var(--color-gray-100)", padding: "16px 18px 18px" }}>

          {/* Client Information */}
          <p style={sectionLabel}>Client Information</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", marginBottom: 20 }}>
            {client.company_name && (
              <div>
                <div style={infoLabel}>Company Name</div>
                <div style={infoValue}>{client.company_name}</div>
              </div>
            )}
            {client.industry_vertical && (
              <div>
                <div style={infoLabel}>Industry Vertical</div>
                <div style={infoValue}>{client.industry_vertical}</div>
              </div>
            )}
            {client.company_address && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={infoLabel}>Company Address</div>
                <div style={{ ...infoValue, whiteSpace: "pre-line" }}>{client.company_address}</div>
              </div>
            )}
            <div>
              <div style={infoLabel}>Client Status</div>
              <div style={{ marginTop: 4 }}>
                <Badge variant={STATUS_BADGE[client.client_status] ?? "neutral"}>
                  {STATUS_LABEL[client.client_status] ?? client.client_status}
                </Badge>
              </div>
            </div>
            <div>
              <div style={infoLabel}>Client Since</div>
              <div style={infoValue}>{formatDate(client.created_at)}</div>
            </div>
          </div>

          {/* Primary Contact */}
          {(client.primary_contact || client.contact_email) && (
            <>
              <p style={sectionLabel}>Primary Contact</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", marginBottom: 20 }}>
                {client.primary_contact && (
                  <div>
                    <div style={infoLabel}>Name</div>
                    <div style={infoValue}>{client.primary_contact}</div>
                  </div>
                )}
                {client.contact_email && (
                  <div>
                    <div style={infoLabel}>Email</div>
                    <div style={infoValue}>
                      <a href={`mailto:${client.contact_email}`} style={{ color: "var(--color-primary)" }}>
                        {client.contact_email}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Additional Contacts */}
          {client.additional_contacts && client.additional_contacts.length > 0 && (
            <>
              <p style={sectionLabel}>Additional Contacts</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {client.additional_contacts.map((contact, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: 24,
                      padding: "8px 12px",
                      background: "var(--color-gray-50)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-gray-200)",
                    }}
                  >
                    {contact.name && (
                      <div>
                        <div style={infoLabel}>Name</div>
                        <div style={infoValue}>{contact.name}</div>
                      </div>
                    )}
                    {contact.email && (
                      <div>
                        <div style={infoLabel}>Email</div>
                        <div style={infoValue}>
                          <a href={`mailto:${contact.email}`} style={{ color: "var(--color-primary)" }}>
                            {contact.email}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--color-gray-100)", marginBottom: 16 }} />

          {/* Engagements */}
          <p style={sectionLabel}>Engagements</p>
          <ClientEngagements clientId={client.id} onNewEngagement={onNewEngagement} />
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type SortMode = "name-asc" | "name-desc" | "updated";

export function ClientsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const canCreate = usePermission("client", "create");
  const canEdit = usePermission("client", "edit");
  const canArchive = usePermission("client", "archive");
  const canDelete = usePermission("client", "delete");

  const [search, setSearch] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>("updated");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<Client | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Client | null>(null);
  const didAutoExpand = React.useRef(false);

  const { data: clients = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients,
    staleTime: 120_000,
  });

  // Auto-expand from URL param — once only
  React.useEffect(() => {
    if (didAutoExpand.current || clients.length === 0) return;
    const expandId = searchParams.get("expand");
    if (expandId && clients.find((c) => c.id === expandId)) {
      setExpandedId(expandId);
      didAutoExpand.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete("expand");
      window.history.replaceState({}, "", url.toString());
    }
  }, [clients, searchParams]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.company_name.toLowerCase().includes(q) ||
        c.industry_vertical.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const sorted = React.useMemo(() => {
    const copy = [...filtered];
    if (sortMode === "name-asc") copy.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMode === "name-desc") copy.sort((a, b) => b.name.localeCompare(a.name));
    else copy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return copy;
  }, [filtered, sortMode]);

  const handleToggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archiveClient(archiveTarget.id);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      if (expandedId === archiveTarget.id) setExpandedId(null);
      toast.success("Client archived");
    } catch {
      toast.error("Failed to archive client. Please try again.");
    } finally {
      setArchiveTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteClient(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      if (expandedId === deleteTarget.id) setExpandedId(null);
      toast.success("Client deleted");
    } catch {
      toast.error("Failed to delete client. Please try again.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleNewEngagementForClient = (clientId: string) => {
    navigate(`/engagements?newFor=${clientId}`);
  };

  const sortOptions: Array<{ value: SortMode; label: string }> = [
    { value: "name-asc", label: "Name (A–Z)" },
    { value: "name-desc", label: "Name (Z–A)" },
    { value: "updated", label: "Recently Updated" },
  ];

  const actions = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {canArchive && (
        <button
          onClick={() => navigate("/clients/archive")}
          style={{
            fontSize: 13, fontWeight: 500, color: "var(--color-gray-500)",
            background: "none", border: "none", cursor: "pointer", padding: "4px 2px",
            textDecoration: "underline",
          }}
        >
          View Archive
        </button>
      )}
      {canCreate && (
        <Button variant="primary" onClick={() => { setEditingClient(null); setFormOpen(true); }}>
          + New Client
        </Button>
      )}
    </div>
  );

  return (
    <PageWrapper title="Clients" actions={actions}>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", maxWidth: 360 }}>
          <Input
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>Sort:</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            style={{
              fontSize: 12, padding: "5px 8px", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-gray-200)", background: "var(--color-white)",
              color: "var(--color-gray-700)", cursor: "pointer",
            }}
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : isError ? (
        <ErrorState message="Failed to load clients." onRetry={refetch} />
      ) : sorted.length === 0 ? (
        <EmptyState
          title={search ? "No clients match your search." : "No clients yet."}
          action={
            canCreate && !search
              ? { label: "+ New Client", onClick: () => { setEditingClient(null); setFormOpen(true); } }
              : undefined
          }
        />
      ) : (
        sorted.map((client) => (
          <ClientRow
            key={client.id}
            client={client}
            isExpanded={expandedId === client.id}
            onToggle={() => handleToggle(client.id)}
            onEdit={() => { setEditingClient(client); setFormOpen(true); }}
            onArchive={() => setArchiveTarget(client)}
            onDelete={() => setDeleteTarget(client)}
            onNewEngagement={handleNewEngagementForClient}
            canEdit={canEdit}
            canArchive={canArchive}
            canDelete={canDelete}
          />
        ))
      )}

      {/* Create / Edit modal */}
      <ClientFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        client={editingClient ?? undefined}
        onSuccess={(saved) => {
          setFormOpen(false);
          toast.success(editingClient ? "Client updated" : "Client saved");
          if (!editingClient) setExpandedId(saved.id);
        }}
      />

      {/* Archive confirm */}
      <ConfirmModal
        isOpen={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        title="Archive Client"
        message={`Archive "${archiveTarget?.name}"? The client will be hidden from the active list and can be restored from the archive.`}
        confirmLabel="Archive"
        confirmVariant="danger"
      />

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Client"
        message={`Delete "${deleteTarget?.name}"? This will remove the client permanently and cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </PageWrapper>
  );
}
