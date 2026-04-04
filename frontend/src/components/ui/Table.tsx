import React from "react";

export interface Column<T> {
  key: string;
  header: string;
  width?: number | string;
  render?: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
}

export function Table<T>({ columns, data, loading, onRowClick, rowKey }: TableProps<T>) {
  return (
    <div
      style={{
        background: "var(--color-white)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-gray-200)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr style={{ background: "var(--color-gray-50)", borderBottom: "1px solid var(--color-gray-200)" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: "10px 16px",
                  textAlign: "left",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-gray-500)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  width: col.width,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--color-gray-100)" }}>
                {columns.map((col) => (
                  <td key={col.key} style={{ padding: "12px 16px" }}>
                    <div
                      style={{
                        height: 14,
                        borderRadius: 4,
                        background: "var(--color-gray-100)",
                        animation: "pulse 1.5s ease-in-out infinite",
                        width: `${50 + Math.random() * 40}%`,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: "40px 16px", textAlign: "center", color: "var(--color-gray-400)", fontSize: 14 }}
              >
                No results found.
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: "1px solid var(--color-gray-100)",
                  cursor: onRowClick ? "pointer" : undefined,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) (e.currentTarget as HTMLElement).style.background = "var(--color-gray-50)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "";
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: "12px 16px",
                      fontSize: 14,
                      color: "var(--color-gray-700)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
