import { Spinner } from "../ui/Spinner";

/**
 * Full-page centered spinner. Use in place of a raw <Spinner> when blocking
 * the entire page while data loads (e.g. Report Builder initial load).
 */
export function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100%",
      }}
    >
      <Spinner size={48} color="var(--color-primary)" />
    </div>
  );
}
