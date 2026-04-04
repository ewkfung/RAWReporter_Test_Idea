import { Button } from "./Button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Something went wrong. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "var(--color-danger-light, #fef2f2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ color: "var(--color-danger)" }}>
          <path
            d="M11 2L21 19H1L11 2Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M11 9v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="11" cy="15.5" r="0.75" fill="currentColor" />
        </svg>
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-gray-700)" }}>{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} style={{ marginTop: 4 }}>
          Retry
        </Button>
      )}
    </div>
  );
}
