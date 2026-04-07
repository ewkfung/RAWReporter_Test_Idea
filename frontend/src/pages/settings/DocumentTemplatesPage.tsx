import React from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Spinner } from "../../components/ui/Spinner";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { usePermission } from "../../hooks/usePermission";
import { useToast } from "../../components/ui/useToast";
import {
  getDocumentTemplates,
  uploadDocumentTemplate,
  deleteDocumentTemplate,
  type DocumentTemplateStatus,
} from "../../api/documentTemplates";
import { getPlatformSettings, updatePlatformSetting } from "../../api/platformSettings";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Firm Name Card ─────────────────────────────────────────────────────────

function FirmNameCard() {
  const toast = useToast();
  const { data: settings } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: getPlatformSettings,
    staleTime: 30_000,
  });

  const [value, setValue] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved">("idle");

  React.useEffect(() => {
    if (settings) {
      setValue(settings["firm_name"] ?? "");
    }
  }, [settings]);

  const handleBlur = async () => {
    setSaveStatus("saving");
    try {
      await updatePlatformSetting("firm_name", value);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      toast.error("Failed to save firm name.");
      setSaveStatus("idle");
    }
  };

  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-200)",
        borderRadius: "var(--radius-md)",
        padding: "20px 24px",
        marginBottom: 16,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: "var(--color-gray-900)" }}>
          Firm Name
        </span>
        <p style={{ fontSize: 13, color: "var(--color-gray-500)", marginTop: 4, marginBottom: 0 }}>
          Appears in generated document cover pages via the <code>RAW_PREPARED_BY</code> bookmark.
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, maxWidth: 400 }}>
          <Input
            value={value}
            onChange={(e) => { setValue(e.target.value); setSaveStatus("idle"); }}
            onBlur={handleBlur}
            placeholder="e.g. Acme Cybersecurity"
          />
        </div>
        {saveStatus === "saving" && <Spinner size={16} />}
        {saveStatus === "saved" && (
          <span style={{ fontSize: 13, color: "var(--color-success)", fontWeight: 500 }}>
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

// ── Bookmark Reference Card (collapsible) ─────────────────────────────────

function BookmarkReferenceCard() {
  const [expanded, setExpanded] = React.useState(false);

  const bookmarks = [
    { name: "RAW_REPORT_TITLE", desc: "Report title from builder" },
    { name: "RAW_CLIENT_NAME", desc: "Client organisation name" },
    { name: "RAW_ENGAGEMENT_TYPE", desc: 'e.g. "Vulnerability Assessment"' },
    { name: "RAW_REPORT_DATE", desc: "Date of generation" },
    { name: "RAW_LEAD_CONSULTANT", desc: "Engagement lead name" },
    { name: "RAW_PREPARED_BY", desc: "Firm name (set above)" },
  ];

  const styles = [
    { name: "Heading 1", use: "Section titles" },
    { name: "Heading 2", use: "Finding titles" },
    { name: "Heading 3", use: "Finding sub-sections" },
    { name: "Normal", use: "Body text paragraphs" },
    { name: "List Bullet", use: "Reference entries" },
  ];

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-gray-600)",
    background: "var(--color-gray-50)",
    borderBottom: "1px solid var(--color-gray-200)",
  };

  const tdStyle: React.CSSProperties = {
    padding: "6px 12px",
    fontSize: 13,
    color: "var(--color-gray-700)",
    borderBottom: "1px solid var(--color-gray-100)",
  };

  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-200)",
        borderRadius: "var(--radius-md)",
        marginBottom: 24,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded((x) => !x)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "16px 24px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: "var(--color-gray-500)",
            transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "none",
            display: "inline-block",
          }}
        >
          ▶
        </span>
        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--color-gray-800)" }}>
          How to prepare your template
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "0 24px 20px" }}>
          {/* Required bookmarks */}
          <p style={{ fontSize: 13, color: "var(--color-gray-600)", marginBottom: 10 }}>
            Insert these named bookmarks in your cover page in Microsoft Word. Go to{" "}
            <strong>Insert → Bookmark</strong>, type the name exactly as shown, and click Add.
          </p>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid var(--color-gray-200)",
              borderRadius: 6,
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Bookmark Name</th>
                <th style={thStyle}>Filled With</th>
              </tr>
            </thead>
            <tbody>
              {bookmarks.map((b) => (
                <tr key={b.name}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{b.name}</td>
                  <td style={tdStyle}>{b.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              background: "var(--color-warning-light)",
              border: "1px solid var(--color-warning)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--color-gray-700)",
              marginBottom: 16,
            }}
          >
            ⚠ Missing bookmarks are skipped — the document still generates, that field is just left blank.
          </div>

          {/* Style names */}
          <p style={{ fontSize: 13, color: "var(--color-gray-600)", marginBottom: 10 }}>
            The generator uses these standard Word style names for report content. Customise them in
            Word's Styles panel to match your branding.
          </p>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid var(--color-gray-200)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Style Name</th>
                <th style={thStyle}>Used For</th>
              </tr>
            </thead>
            <tbody>
              {styles.map((s) => (
                <tr key={s.name}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{s.name}</td>
                  <td style={tdStyle}>{s.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Template Card ──────────────────────────────────────────────────────────

function TemplateCard({ item, onRefresh }: { item: DocumentTemplateStatus; onRefresh: () => void }) {
  const toast = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = React.useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      await uploadDocumentTemplate(item.engagement_type, file);
      toast.success("Template uploaded successfully.");
      onRefresh();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? "Upload failed. Please try again.";
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    await deleteDocumentTemplate(item.engagement_type);
    toast.success("Template removed.");
    onRefresh();
  };

  const t = item.template;

  return (
    <>
      <div
        style={{
          background: "var(--color-white)",
          border: "1px solid var(--color-gray-200)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Left: type info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--color-gray-900)" }}>
              {item.display_name}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--color-gray-500)",
                background: "var(--color-gray-100)",
                borderRadius: 99,
                padding: "2px 8px",
                fontFamily: "monospace",
              }}
            >
              {item.engagement_type}
            </span>
          </div>

          {t ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-success)",
                  background: "var(--color-success-light)",
                  padding: "2px 8px",
                  borderRadius: 99,
                }}
              >
                ✓ Template uploaded
              </span>
              <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>{t.original_filename}</span>
              <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
                {formatBytes(t.file_size_bytes)}
              </span>
              <span style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
                {formatDate(t.uploaded_at)}
                {t.uploaded_by_name ? ` by ${t.uploaded_by_name}` : ""}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-warning)",
                  background: "var(--color-warning-light)",
                  padding: "2px 8px",
                  borderRadius: 99,
                }}
              >
                ⚠ No template uploaded
              </span>
              <span style={{ fontSize: 12, color: "var(--color-gray-400)", fontStyle: "italic" }}>
                Reports cannot be generated for this type until a template is uploaded.
              </span>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          {t ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                loading={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowRemoveConfirm(true)}
              >
                Remove
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Template
            </Button>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={handleRemove}
        title="Remove Template"
        message={`Remove the uploaded template for "${item.display_name}"? Reports of this type will no longer be exportable until a new template is uploaded.`}
        confirmLabel="Remove"
        confirmVariant="danger"
      />
    </>
  );
}

// ── DocumentTemplatesPage ──────────────────────────────────────────────────

export function DocumentTemplatesPage() {
  const canUpload = usePermission("document_template", "upload");
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["document-templates"],
    queryFn: getDocumentTemplates,
    staleTime: 30_000,
    enabled: canUpload,
  });

  if (!canUpload) {
    return <Navigate to="/" replace />;
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["document-templates"] });

  return (
    <PageWrapper title="Document Templates">
      <p style={{ fontSize: 14, color: "var(--color-gray-500)", marginBottom: 24, marginTop: -4 }}>
        Upload a .docx base template for each report type. The template provides the document's
        visual styling — cover page design, fonts, headers, and footers. Report content is
        generated automatically from the report builder.
      </p>

      <FirmNameCard />
      <BookmarkReferenceCard />

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Spinner size={28} />
        </div>
      ) : (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-gray-700)", marginBottom: 12 }}>
            Templates
          </h3>
          {(templates ?? []).map((item) => (
            <TemplateCard key={item.engagement_type} item={item} onRefresh={refresh} />
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
