type Tone = "good" | "warn" | "danger";

type Props = {
  value: number;
  max?: number;
  tone?: Tone;
};

export function RiskBar({ value, max = 100, tone }: Props) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const t: Tone = tone ?? (value >= 80 ? "good" : value >= 60 ? "warn" : "danger");
  const color = `var(--${t})`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          position: "relative",
          flex: 1,
          height: 4,
          background: "var(--surface-3)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${pct}%`,
            background: color,
            borderRadius: 999,
          }}
        />
      </div>
      <span className="num" style={{ fontSize: 12, color: "var(--text-1)", minWidth: 28, textAlign: "right" }}>
        {Math.round(value)}
      </span>
    </div>
  );
}

export default RiskBar;
