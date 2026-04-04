import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { usePermission } from "../../hooks/usePermission";
import { useToast } from "../../components/ui/useToast";
import { getArchivedClients, restoreClient, deleteClient } from "../../api/clients";
import { formatDate } from "../../utils/formatting";
import type { Client, ClientStatus } from "../../types/models";
import type { BadgeVariant } from "../../components/ui/Badge";

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

export function ClientArchivePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const canArchive = usePermission("client", "archive");
  const canDelete = usePermission("client", "delete");

  const [deleteTarget, setDeleteTarget] = React.useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients-archived"],
    queryFn: getArchivedClients,
    enabled: canArchive,
  });

  if (!canArchive) {
    return <Navigate to="/clients" replace />;
  }

  const handleRestore = async (client: Client) => {
    await restoreClient(client.id);
    queryClient.invalidateQueries({ queryKey: ["clients-archived"] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    toast.success("Client restored");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteClient(deleteTarget.id);
    queryClient.invalidateQueries({ queryKey: ["clients-archived"] });
    toast.success("Client permanently deleted");
    setDeleteTarget(null);
  };

  return (
    <PageWrapper
      title="Archived Clients"
      breadcrumbs={[
        { label: "Clients", to: "/clients" },
        { label: "Archive" },
      ]}
    >
      {/* Back link */}
      <button
        onClick={() => navigate("/clients")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-gray-500)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          marginBottom: 20,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Clients
      </button>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <Spinner size={32} />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState title="No archived clients." />
      ) : (
        <div>
          {clients.map((client) => (
            <ArchivedClientRow
              key={client.id}
              client={client}
              canDelete={canDelete}
              onRestore={handleRestore}
              onDelete={(c) => setDeleteTarget(c)}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Client Permanently"
        message={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
      />
    </PageWrapper>
  );
}

// ── Row component ──────────────────────────────────────────────────────────

function ArchivedClientRow({
  client,
  canDelete,
  onRestore,
  onDelete,
}: {
  client: Client;
  canDelete: boolean;
  onRestore: (c: Client) => Promise<void>;
  onDelete: (c: Client) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);

  const handleRestore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRestoring(true);
    try {
      await onRestore(client);
    } finally {
      setRestoring(false);
    }
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
        marginBottom: 6,
        opacity: 0.85,
      }}
    >
      {/* Row header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          style={{
            flexShrink: 0,
            color: "var(--color-gray-400)",
            transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            display: "inline-flex",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>

        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--color-gray-900)" }}>
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

        {/* Controls */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {client.archived_at && (
            <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
              Archived {formatDate(client.archived_at)}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={handleRestore} loading={restoring}>
            Restore
          </Button>
          {canDelete && (
            <Button variant="danger" size="sm" onClick={() => onDelete(client)}>
              Delete Permanently
            </Button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--color-gray-100)",
            padding: "14px 38px 16px",
            background: "var(--color-gray-50)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
            {client.company_name && (
              <div>
                <div style={infoLabel}>Company Name</div>
                <div style={infoValue}>{client.company_name}</div>
              </div>
            )}
            {client.primary_contact && (
              <div>
                <div style={infoLabel}>Primary Contact</div>
                <div style={infoValue}>{client.primary_contact}</div>
              </div>
            )}
            {client.contact_email && (
              <div>
                <div style={infoLabel}>Contact Email</div>
                <div style={infoValue}>
                  <a href={`mailto:${client.contact_email}`} style={{ color: "var(--color-primary)" }}>
                    {client.contact_email}
                  </a>
                </div>
              </div>
            )}
            {client.company_address && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={infoLabel}>Company Address</div>
                <div style={{ ...infoValue, whiteSpace: "pre-line" }}>{client.company_address}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
