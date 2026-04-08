import React from "react";

interface InactivityWarningModalProps {
  isOpen: boolean;
  secondsLeft: number;
  onStayActive: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function InactivityWarningModal({
  isOpen,
  secondsLeft,
  onStayActive,
}: InactivityWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      {/* Backdrop — intentionally non-interactive */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(3px)",
        }}
      />

      {/* Card */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="inactivity-title"
        aria-describedby="inactivity-body"
        style={{
          position: "relative",
          background: "var(--color-white)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderTop: "4px solid #d97706",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 0",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* Warning icon */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            style={{ flexShrink: 0, color: "#d97706" }}
          >
            <path
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h2
            id="inactivity-title"
            style={{ fontSize: 16, fontWeight: 700, color: "var(--color-gray-900)" }}
          >
            Session Expiring Soon
          </h2>
        </div>

        {/* Body */}
        <div id="inactivity-body" style={{ padding: "16px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--color-gray-600)", marginBottom: 20, lineHeight: 1.5 }}>
            You've been inactive for a while. For security, you will be automatically
            logged out in:
          </p>

          {/* Countdown */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              letterSpacing: "-1px",
              color: secondsLeft <= 60 ? "#dc2626" : "#d97706",
              fontVariantNumeric: "tabular-nums",
              marginBottom: 24,
              transition: "color 0.3s",
            }}
          >
            {formatTime(secondsLeft)}
          </div>

          <button
            onClick={onStayActive}
            style={{
              width: "100%",
              padding: "10px 20px",
              background: "#d97706",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: 8,
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#b45309";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#d97706";
            }}
          >
            I'm Still Here
          </button>

          <p style={{ fontSize: 12, color: "var(--color-gray-400)" }}>
            Click to stay logged in
          </p>
        </div>
      </div>
    </div>
  );
}
