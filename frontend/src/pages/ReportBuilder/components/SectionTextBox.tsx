import React from "react";
import { updateSection } from "../../../api/sections";
import { SaveIndicator, useSaveState } from "./SaveIndicator";

interface SectionTextBoxProps {
  sectionId: string;
  sectionType: string;
  title: string;
  initialBodyText: string;
  readOnly?: boolean;
}

export function SectionTextBox({
  sectionId,
  title,
  initialBodyText,
  readOnly,
}: SectionTextBoxProps) {
  const [value, setValue] = React.useState(initialBodyText);
  const { state, setSaving, setSaved, setError } = useSaveState();
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 200)}px`;
  };

  React.useEffect(() => { autoResize(); }, [value]);

  const save = async (text: string) => {
    setSaving();
    try {
      await updateSection(sectionId, { body_text: text });
      setSaved();
    } catch {
      setError();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(e.target.value), 500);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    save(value);
  };

  React.useEffect(
    () => () => { if (debounceRef.current) clearTimeout(debounceRef.current); },
    []
  );

  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-200)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-gray-900)", margin: 0 }}>
          {title}
        </h3>
        <SaveIndicator state={state} />
      </div>
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
    </div>
  );
}
