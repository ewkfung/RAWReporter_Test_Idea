import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "var(--color-gray-50)",
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              textAlign: "center",
              maxWidth: 400,
            }}
          >
            {/* Warning icon */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--color-danger-light, #fef2f2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ color: "var(--color-danger)" }}>
                <path
                  d="M14 3L25.5 23H2.5L14 3Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M14 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="19.5" r="1" fill="currentColor" />
              </svg>
            </div>

            <div>
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--color-gray-900)",
                  marginBottom: 6,
                }}
              >
                Something went wrong
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--color-gray-500)",
                  lineHeight: 1.6,
                }}
              >
                An unexpected error occurred. Try refreshing the page.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "7px 16px",
                  background: "var(--color-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                Reload Page
              </button>
              <button
                onClick={() => { window.location.href = "/"; }}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "7px 16px",
                  background: "var(--color-white)",
                  color: "var(--color-gray-700)",
                  border: "1px solid var(--color-gray-300)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
