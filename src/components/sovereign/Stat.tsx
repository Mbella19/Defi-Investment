import type { ReactNode } from "react";

type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { v: number; g: number }> = {
  sm: { v: 18, g: 4 },
  md: { v: 26, g: 6 },
  lg: { v: 36, g: 8 },
  xl: { v: 52, g: 10 },
};

type Props = {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaUp?: boolean;
  sub?: ReactNode;
  size?: Size;
};

export function Stat({ label, value, delta, deltaUp, sub, size = "md" }: Props) {
  const s = SIZES[size];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: s.g }}>
      <div className="eyebrow" style={{ fontSize: 10 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span
          className="num display"
          style={{
            fontSize: s.v,
            fontWeight: 500,
            color: "var(--text)",
            letterSpacing: "-0.03em",
          }}
        >
          {value}
        </span>
        {delta ? (
          <span className={deltaUp ? "delta-up" : "delta-dn"}>
            {deltaUp ? "▲" : "▼"} {delta}
          </span>
        ) : null}
      </div>
      {sub ? <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{sub}</div> : null}
    </div>
  );
}

export default Stat;
