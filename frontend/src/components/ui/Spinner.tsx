
interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 16, color = "currentColor" }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      style={{ animation: "spin 0.7s linear infinite", display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" stroke={color} strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
