import React from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";

interface BlockingFinding {
  id: string;
  title: string;
  section: string;
}

interface GenerationBlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockingFindings: BlockingFinding[];
}

export function GenerationBlockedModal({
  isOpen,
  onClose,
  blockingFindings,
}: GenerationBlockedModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Report Cannot Be Generated"
      width={520}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <p
        style={{
          fontSize: 14,
          color: "var(--color-danger)",
          fontWeight: 500,
          marginBottom: 12,
        }}
      >
        The following findings have been placed in sections that don't match their severity
        rating and require a justification before the report can be exported:
      </p>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {blockingFindings.map((f) => (
          <li
            key={f.id}
            style={{ fontSize: 14, color: "var(--color-gray-700)", marginBottom: 6 }}
          >
            <span style={{ fontWeight: 500 }}>{f.title}</span>
            {f.section && (
              <span style={{ fontSize: 12, color: "var(--color-gray-500)", marginLeft: 6 }}>
                — {f.section}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
