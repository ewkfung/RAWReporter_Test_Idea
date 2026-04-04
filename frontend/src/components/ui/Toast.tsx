import { useToastStore, type ToastVariant } from "./useToast";

const variantStyles: Record<ToastVariant, { bg: string; border: string; icon: string }> = {
  success: { bg: "var(--color-success-light)", border: "var(--color-success)", icon: "✓" },
  error:   { bg: "var(--color-danger-light)",  border: "var(--color-danger)",  icon: "✕" },
  warning: { bg: "var(--color-warning-light)", border: "var(--color-warning)", icon: "⚠" },
  info:    { bg: "var(--color-primary-light)", border: "var(--color-primary)", icon: "i" },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const s = variantStyles[t.variant];
        return (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              boxShadow: "var(--shadow-md)",
              fontSize: 14,
              maxWidth: 360,
              pointerEvents: "auto",
              animation: "slideIn 0.2s ease",
            }}
          >
            <span style={{ fontWeight: 700, color: s.border, fontSize: 13 }}>{s.icon}</span>
            <span style={{ flex: 1, color: "var(--color-gray-700)" }}>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-gray-400)",
                padding: 2,
                fontSize: 13,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  );
}
