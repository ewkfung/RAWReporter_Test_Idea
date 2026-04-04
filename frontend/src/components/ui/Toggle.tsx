
interface ToggleProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, disabled }: ToggleProps) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        userSelect: "none",
      }}
    >
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          position: "relative",
          display: "inline-block",
          width: 36,
          height: 20,
          borderRadius: 999,
          background: checked ? "var(--color-primary)" : "var(--color-gray-300)",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "var(--color-white)",
            boxShadow: "var(--shadow-sm)",
            transition: "left 0.2s",
          }}
        />
      </span>
      {label && (
        <span style={{ fontSize: 14, color: "var(--color-gray-700)" }}>{label}</span>
      )}
    </label>
  );
}
