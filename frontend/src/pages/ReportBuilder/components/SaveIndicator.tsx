import React from "react";
import { Spinner } from "../../../components/ui/Spinner";

type SaveState = "idle" | "saving" | "saved" | "error";

interface SaveIndicatorProps {
  state: SaveState;
}

export function SaveIndicator({ state }: SaveIndicatorProps) {
  if (state === "idle") return null;

  const config = {
    saving: { color: "var(--color-gray-400)", text: "Saving…" },
    saved:  { color: "var(--color-success)", text: "Saved" },
    error:  { color: "var(--color-danger)",  text: "Save failed" },
  }[state];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        color: config.color,
        transition: "opacity 0.3s",
      }}
    >
      {state === "saving" && <Spinner size={12} />}
      {state === "saved" && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {config.text}
    </span>
  );
}

/** Returns save state management helpers */
export function useSaveState() {
  const [state, setState] = React.useState<SaveState>("idle");
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSaving = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState("saving");
  };

  const setSaved = () => {
    setState("saved");
    timerRef.current = setTimeout(() => setState("idle"), 2000);
  };

  const setError = () => {
    setState("error");
    timerRef.current = setTimeout(() => setState("idle"), 3000);
  };

  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { state, setSaving, setSaved, setError };
}
