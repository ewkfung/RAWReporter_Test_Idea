import React from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
}

export function Select({ label, error, hint, options, placeholder, required, id, style, ...rest }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)" }}
        >
          {label}
          {required && <span style={{ color: "var(--color-danger)", marginLeft: 2 }}>*</span>}
        </label>
      )}
      <select
        id={inputId}
        {...rest}
        style={{
          height: 36,
          padding: "0 10px",
          fontSize: 14,
          borderRadius: "var(--radius-sm)",
          border: `1px solid ${error ? "var(--color-danger)" : "var(--color-gray-300)"}`,
          background: "var(--color-white)",
          color: rest.value === "" ? "var(--color-gray-400)" : "var(--color-gray-900)",
          outline: "none",
          width: "100%",
          cursor: "pointer",
          transition: "border-color 0.15s, box-shadow 0.15s",
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          paddingRight: 30,
          ...style,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--color-primary)";
          e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)";
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? "var(--color-danger)" : "var(--color-gray-300)";
          e.target.style.boxShadow = "none";
          rest.onBlur?.(e);
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: 12, color: "var(--color-gray-500)" }}>{hint}</span>}
    </div>
  );
}
