import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { SkeletonTable } from "../../components/loading/SkeletonTable";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import { LibraryFindingRow } from "../../components/library/LibraryFindingRow";
import { LibraryFindingFormModal } from "../../components/library/LibraryFindingFormModal";
import { usePermission } from "../../hooks/usePermission";
import { useToast } from "../../components/ui/useToast";
import {
  getLibraryFindings,
  deleteLibraryFinding,
} from "../../api/library";
import { apiClient } from "../../api/client";
import type { LibraryFinding, Severity } from "../../types/models";

const SEVERITIES: Array<{ label: string; value: Severity | "all" }> = [
  { label: "All", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "Informational", value: "informational" },
];

type SortMode = "alpha" | "severity";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0, high: 1, medium: 2, low: 3, informational: 4,
};

export function LibraryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const canCreate = usePermission("library_finding", "create");
  const canArchive = usePermission("library_finding", "archive");

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState<Severity | "all">("all");
  const [sortMode, setSortMode] = React.useState<SortMode>("severity");
  const [editingFinding, setEditingFinding] = React.useState<LibraryFinding | null>(null);
  const [formModalOpen, setFormModalOpen] = React.useState(false);

  // Debounce search input 300ms
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: findings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["library", debouncedSearch, severityFilter],
    queryFn: () =>
      getLibraryFindings({
        search: debouncedSearch || undefined,
        severity: severityFilter !== "all" ? severityFilter : undefined,
      }),
  });

  const sorted = React.useMemo(() => {
    const copy = [...findings];
    if (sortMode === "alpha") {
      copy.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      copy.sort((a, b) => {
        const diff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        return diff !== 0 ? diff : a.title.localeCompare(b.title);
      });
    }
    return copy;
  }, [findings, sortMode]);

  const archiveMutation = useMutation({
    mutationFn: (finding: LibraryFinding) =>
      apiClient.post(`/library/${finding.id}/archive`),
    onMutate: async (finding) => {
      await queryClient.cancelQueries({ queryKey: ["library"] });
      const previousData = queryClient.getQueriesData<LibraryFinding[]>({ queryKey: ["library"] });
      queryClient.setQueriesData<LibraryFinding[]>({ queryKey: ["library"] }, (old) => {
        if (!old) return old;
        return old.filter((f) => f.id !== finding.id);
      });
      return { previousData };
    },
    onSuccess: (_, finding) => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      toast.success(`"${finding.title}" archived`);
    },
    onError: (_err, _finding, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast.error("Failed to archive finding. Please try again.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (finding: LibraryFinding) => deleteLibraryFinding(finding.id),
    onMutate: async (finding) => {
      await queryClient.cancelQueries({ queryKey: ["library"] });
      const previousData = queryClient.getQueriesData<LibraryFinding[]>({ queryKey: ["library"] });
      queryClient.setQueriesData<LibraryFinding[]>({ queryKey: ["library"] }, (old) => {
        if (!old) return old;
        return old.filter((f) => f.id !== finding.id);
      });
      return { previousData };
    },
    onSuccess: (_, finding) => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      toast.success(`"${finding.title}" deleted`);
    },
    onError: (_err, _finding, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast.error("Failed to delete finding. Please try again.");
    },
  });

  const handleEdit = (finding: LibraryFinding) => {
    setEditingFinding(finding);
    setFormModalOpen(true);
  };

  const handleNewFinding = () => {
    setEditingFinding(null);
    setFormModalOpen(true);
  };

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 12px",
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

  const actions = (
    <>
      {canArchive && (
        <Button variant="secondary" onClick={() => navigate("/library/archive")}>
          View Archive
        </Button>
      )}
      {canCreate && (
        <Button variant="primary" onClick={handleNewFinding}>
          New Finding
        </Button>
      )}
    </>
  );

  return (
    <PageWrapper title="Findings Library" actions={actions}>
      {/* Filter bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: "1 1 240px", maxWidth: 360 }}>
            <Input
              placeholder="Search title or summary…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--color-gray-500)", marginRight: 2 }}>Sort:</span>
            <button style={pillStyle(sortMode === "severity")} onClick={() => setSortMode("severity")}>
              Severity
            </button>
            <button style={pillStyle(sortMode === "alpha")} onClick={() => setSortMode("alpha")}>
              A–Z
            </button>
          </div>
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

      {/* List */}
      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : isError ? (
        <ErrorState message="Failed to load library findings." onRetry={refetch} />
      ) : sorted.length === 0 ? (
        <EmptyState
          title={
            debouncedSearch || severityFilter !== "all"
              ? "No findings match your search"
              : canCreate
              ? "No findings in the library yet. Create the first one."
              : "No findings in the library yet."
          }
          action={
            canCreate && !debouncedSearch && severityFilter === "all"
              ? { label: "New Finding", onClick: handleNewFinding }
              : undefined
          }
        />
      ) : (
        <div>
          {sorted.map((f) => (
            <LibraryFindingRow
              key={f.id}
              finding={f}
              onEdit={handleEdit}
              onArchive={archiveMutation.mutate}
              onDelete={deleteMutation.mutate}
            />
          ))}
        </div>
      )}

      <LibraryFindingFormModal
        key={editingFinding?.id ?? "new"}
        isOpen={formModalOpen}
        finding={editingFinding}
        onClose={() => setFormModalOpen(false)}
        onSaved={() => {
          setFormModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["library"] });
          toast.success(editingFinding ? "Finding updated" : "Finding created");
        }}
      />
    </PageWrapper>
  );
}
