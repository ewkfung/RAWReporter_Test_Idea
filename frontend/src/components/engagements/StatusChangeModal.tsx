import React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { updateEngagement } from "../../api/engagements";
import { useToast } from "../ui/useToast";
import type { Engagement, EngagementStatus } from "../../types/models";

interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  engagement?: Engagement;
  onSuccess: () => void;
}

const STATUS_OPTIONS = [
  { value: "scoping", label: "Scoping" },
  { value: "active", label: "Active" },
  { value: "in_review", label: "In Review" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

const STATUS_LABEL: Record<EngagementStatus, string> = {
  scoping: "Scoping",
  active: "Active",
  in_review: "In Review",
  delivered: "Delivered",
  completed: "Completed",
  closed: "Closed",
};

export function StatusChangeModal({
  isOpen,
  onClose,
  engagement,
  onSuccess,
}: StatusChangeModalProps) {
  const toast = useToast();
  const [newStatus, setNewStatus] = React.useState<EngagementStatus>("scoping");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && engagement) {
      setNewStatus(engagement.status);
      setError(null);
    }
  }, [isOpen, engagement]);

  const handleSave = async () => {
    if (!engagement) return;
    setSaving(true);
    setError(null);
    try {
      const patch: { status: EngagementStatus; completed_date?: string } = { status: newStatus };
      if ((newStatus === "completed" || newStatus === "closed") && !engagement.completed_date) {
        patch.completed_date = new Date().toISOString().slice(0, 10);
      }
      await updateEngagement(engagement.id, patch);
      toast.success(`Status updated to ${STATUS_LABEL[newStatus]}`);
      onSuccess();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Status"
      width="min(90vw, 380px)"
      footer={
        <>
          {error && (
            <span style={{ fontSize: 13, color: "var(--color-danger)", marginRight: "auto" }}>
              {error}
            </span>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={newStatus === engagement?.status}
          >
            Update Status
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {engagement && (
          <div style={{ fontSize: 13, color: "var(--color-gray-600)" }}>
            <span style={{ fontWeight: 600 }}>{engagement.title}</span>
            <br />
            Current status:{" "}
            <span style={{ fontWeight: 500 }}>{STATUS_LABEL[engagement.status]}</span>
          </div>
        )}
        <Select
          label="New Status"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value as EngagementStatus)}
          options={STATUS_OPTIONS}
        />
      </div>
    </Modal>
  );
}
