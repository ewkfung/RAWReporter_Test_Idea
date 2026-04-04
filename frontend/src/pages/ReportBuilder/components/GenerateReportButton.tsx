import React from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import type { Finding } from "../../../types/models";

interface GenerateReportButtonProps {
  findings: Finding[];
}

export function GenerateReportButton({ findings }: GenerateReportButtonProps) {
  const [modalOpen, setModalOpen] = React.useState(false);

  // Find findings that block generation
  const blockingFindings = findings.filter(
    (f) =>
      f.is_placement_override &&
      (!f.override_justification || f.override_justification.trim() === "")
  );

  const isValid = blockingFindings.length === 0;

  const handleClick = () => {
    setModalOpen(true);
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 16, paddingBottom: 32 }}>
        <Button variant="primary" size="lg" onClick={handleClick}>
          Generate Report
        </Button>
      </div>

      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Report Generation"
          width={520}
          footer={
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Close
            </Button>
          }
        >
          {isValid ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  background: "var(--color-success-light)",
                  border: "1px solid var(--color-success)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M3 9l4 4 8-8" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p style={{ fontSize: 14, color: "var(--color-gray-700)", margin: 0, lineHeight: 1.5 }}>
                  All findings are valid. Document generation will create a DOCX report in Phase 4.
                </p>
              </div>
              <p style={{ fontSize: 13, color: "var(--color-gray-500)", margin: 0 }}>
                Document generation will be implemented in Phase 4. For now, this button confirms
                that all findings have valid placements and justifications.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  background: "var(--color-danger-light)",
                  border: "1px solid var(--color-danger)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M9 3v7M9 13v1" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="9" cy="9" r="8" stroke="var(--color-danger)" strokeWidth="1.5" />
                </svg>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-danger)", margin: "0 0 6px" }}>
                    Cannot generate report
                  </p>
                  <p style={{ fontSize: 14, color: "var(--color-gray-700)", margin: "0 0 10px", lineHeight: 1.5 }}>
                    Some findings have severity overrides without justification. Please edit these
                    findings and provide a justification before generating.
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {blockingFindings.map((f) => (
                      <li key={f.id} style={{ fontSize: 13, color: "var(--color-danger)", marginBottom: 3 }}>
                        {f.title}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
