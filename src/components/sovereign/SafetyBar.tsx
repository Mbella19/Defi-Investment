type SafetyBarProps = {
  value: number;
  height?: number;
  showLabel?: boolean;
};

export function SafetyBar({ value, height = 4, showLabel = false }: SafetyBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped >= 85 ? "var(--good)" : clamped >= 65 ? "var(--warn)" : "var(--danger)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <div
        style={{
          flex: 1,
          height,
          background: "var(--surface-3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: "100%",
            background: color,
            transition: "width 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      </div>
      {showLabel ? (
        <span
          className="mono tabular"
          style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.12em" }}
        >
          {clamped.toFixed(0)}
        </span>
      ) : null}
    </div>
  );
}

export default SafetyBar;
