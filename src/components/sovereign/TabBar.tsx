"use client";

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (t: T) => void;
}

export function TabBar<T extends string>({ tabs, value, onChange }: TabBarProps<T>) {
  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid var(--line)",
        marginBottom: 32,
        overflowX: "auto",
      }}
    >
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="mono"
            style={{
              padding: "14px 24px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
              marginBottom: -1,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: active ? "var(--accent)" : "var(--text-dim)",
              cursor: "pointer",
              fontWeight: active ? 600 : 400,
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default TabBar;
