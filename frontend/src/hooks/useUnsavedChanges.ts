import React from "react";
import { useBlocker } from "react-router-dom";
import type { Blocker } from "react-router-dom";

/**
 * Warns the user before they lose unsaved changes.
 *
 * - Intercepts browser tab close / refresh via `window.beforeunload`
 * - Blocks in-app React Router navigation when `isDirty` is true
 *
 * Usage:
 *   const { blocker } = useUnsavedChanges(hasUnsavedEdits);
 *   // Render a ConfirmModal when blocker.state === "blocked"
 */
export function useUnsavedChanges(isDirty: boolean): { blocker: Blocker } {
  const blocker = useBlocker(isDirty);

  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  return { blocker };
}
