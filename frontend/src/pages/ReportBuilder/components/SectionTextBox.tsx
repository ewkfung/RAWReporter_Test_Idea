import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateSection } from "../../../api/sections";
import { SaveIndicator, useSaveState } from "./SaveIndicator";

interface SectionTextBoxProps {
  sectionId: string;
  sectionType: string;
  title: string;
  initialBodyText: string;
  templateBodyText?: string;
  isVisible?: boolean;
  canToggleVisibility?: boolean;
  readOnly?: boolean;
}

export function SectionTextBox({
  sectionId,
  title,
  initialBodyText,
  templateBodyText = "",
  isVisible = true,
  canToggleVisibility = false,
  readOnly,
}: SectionTextBoxProps) {
  const queryClient = useQueryClient();
  const effectiveInitial = initialBodyText || templateBodyText;
  const [value, setValue] = React.useState(effectiveInitial);
  const [collapsed, setCollapsed] = React.useState(false);
  const [visible, setVisible] = React.useState(isVisible);
  const { state, setSaving, setSaved, setError } = useSaveState();
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  // Track whether the user has made local edits. If not, sync from props
  // when they change (e.g. background refetch returns template content that was
  // missing from the stale cached section data on first render).
  const hasUserEditedRef = React.useRef(false);

  React.useEffect(() => {
    if (!hasUserEditedRef.current) {
      setValue(initialBodyText || templateBodyText);
    }
  }, [initialBodyText, templateBodyText]);

  // Auto-resize textarea
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 200)}px`;
  };

  React.useEffect(() => { autoResize(); }, [value, collapsed]);

  const save = async (text: string) => {
    setSaving();
    try {
      await updateSection(sectionId, { body_text: text });
      setSaved();
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch {
      setError();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    hasUserEditedRef.current = true;
    setValue(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(e.target.value), 500);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    save(value);
  };

  const handleToggleVisibility = async () => {
    const next = !visible;
    setVisible(next);
    try {
      await updateSection(sectionId, { is_visible: next });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch {
      setVisible(!next); // revert on error
    }
  };

  React.useEffect(
    () => () => { if (debounceRef.current) clearTimeout(debounceRef.current); },
    []
  );

  // Preview shown when collapsed
  const preview = value.trim()
    ? value.trim().slice(0, 120) + (value.trim().length > 120 ? "…" : "")
    : null;

  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-200)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        boxShadow: "var(--shadow-sm)",
        opacity: visible ? 1 : 0.6,
        transition: "opacity 0.15s",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: collapsed ? 0 : 12,
          gap: 8,
        }}
      >
        {/* Collapse chevron + title */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            flex: 1,
            textAlign: "left",
            minWidth: 0,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{
              flexShrink: 0,
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              color: "var(--color-gray-400)",
            }}
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--color-gray-900)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </h3>
        </button>

        {/* Right controls: visibility toggle + save indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {canToggleVisibility && (
            <button
              type="button"
              onClick={handleToggleVisibility}
              title={visible ? "Hide section in report" : "Show section in report"}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                display: "flex",
                alignItems: "center",
                color: visible ? "var(--color-gray-400)" : "var(--color-gray-300)",
              }}
            >
              {visible ? (
                // Eye open
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              ) : (
                // Eye closed
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M6.5 6.6A2 2 0 0 0 9.4 9.5M4.1 4.2C2.4 5.2 1 8 1 8s2.5 5 7 5c1.4 0 2.6-.4 3.6-1M6 3.2C6.6 3.1 7.3 3 8 3c4.5 0 7 5 7 5s-.6 1.2-1.7 2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}
          <SaveIndicator state={state} />
        </div>
      </div>

      {/* Collapsed preview */}
      {collapsed && (
        <div
          style={{
            fontSize: 13,
            color: preview ? "var(--color-gray-500)" : "var(--color-gray-300)",
            fontStyle: preview ? "normal" : "italic",
            paddingTop: 4,
            paddingLeft: 24,
          }}
        >
          {preview ?? "[Empty]"}
        </div>
      )}

      {/* Expanded textarea */}
      {!collapsed && (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={readOnly}
          placeholder={`Enter ${title} content…`}
          style={{
            width: "100%",
            minHeight: 200,
            padding: "10px 12px",
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--color-gray-900)",
            border: "1px solid var(--color-gray-200)",
            borderRadius: "var(--radius-md)",
            background: readOnly ? "var(--color-gray-50)" : "var(--color-white)",
            outline: "none",
            resize: "vertical",
            fontFamily: "var(--font-sans)",
            transition: "border-color 0.15s, box-shadow 0.15s",
            boxSizing: "border-box",
          }}
          onFocus={(e) => {
            if (!readOnly) {
              e.target.style.borderColor = "var(--color-primary)";
              e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)";
            }
          }}
          onBlurCapture={(e) => {
            e.target.style.borderColor = "var(--color-gray-200)";
            e.target.style.boxShadow = "none";
          }}
        />
      )}
    </div>
  );
}
