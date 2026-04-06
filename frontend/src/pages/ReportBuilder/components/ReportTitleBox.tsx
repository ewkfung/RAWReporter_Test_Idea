import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateReport } from "../../../api/reports";
import { SaveIndicator, useSaveState } from "./SaveIndicator";

interface ReportTitleBoxProps {
  reportId: string;
  initialTitle: string;
  readOnly?: boolean;
}

export function ReportTitleBox({ reportId, initialTitle, readOnly }: ReportTitleBoxProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = React.useState(initialTitle);
  const { state, setSaving, setSaved, setError } = useSaveState();
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBlur = async () => {
    if (value === initialTitle) return;
    setSaving();
    try {
      await updateReport(reportId, { title: value });
      setSaved();
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch {
      setError();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving();
      try {
        await updateReport(reportId, { title: e.target.value });
        setSaved();
        queryClient.invalidateQueries({ queryKey: ["reports"] });
      } catch {
        setError();
      }
    }, 500);
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
        padding: "16px 20px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={readOnly}
          placeholder="Report Title"
          style={{
            flex: 1,
            fontSize: 22,
            fontWeight: 600,
            color: "var(--color-gray-900)",
            border: "none",
            outline: "none",
            background: "transparent",
            padding: 0,
            lineHeight: 1.3,
          }}
        />
        <SaveIndicator state={state} />
      </div>
    </div>
  );
}
