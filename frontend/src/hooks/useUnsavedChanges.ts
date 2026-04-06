import React from "react";

/**
 * Warns the user before they lose unsaved changes.
 *
 * Intercepts browser tab close / refresh via `window.beforeunload`.
 *
 * Note: in-app navigation blocking via useBlocker requires the data router
 * (createBrowserRouter + RouterProvider) and is not supported with BrowserRouter.
 *
 * Usage:
 *   useUnsavedChanges(hasUnsavedEdits);
 */
export function useUnsavedChanges(isDirty: boolean): void {
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
