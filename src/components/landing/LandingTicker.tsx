"use client";

const PROTOCOLS = [
  { name: "Aave V3", apy: 4.82, change: 0.12 },
  { name: "Compound", apy: 4.21, change: -0.08 },
  { name: "Morpho Blue", apy: 6.44, change: 0.34 },
  { name: "Pendle", apy: 12.18, change: 1.22 },
  { name: "Spark", apy: 5.12, change: 0.04 },
  { name: "Gearbox", apy: 8.76, change: -0.44 },
  { name: "Silo", apy: 9.41, change: 2.11 },
  { name: "Radiant", apy: 14.22, change: -1.74 },
  { name: "Ethena", apy: 18.62, change: 0.88 },
  { name: "Lido", apy: 3.18, change: 0.02 },
  { name: "Convex", apy: 11.02, change: 0.28 },
  { name: "GMX", apy: 16.44, change: 3.12 },
];

export function LandingTicker() {
  const feed = [...PROTOCOLS, ...PROTOCOLS];
  return (
    <section
      style={{
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        padding: "18px 0",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      <div
        className="marquee mono"
        style={{ fontSize: 12, letterSpacing: "0.1em" }}
      >
        {feed.map((p, i) => (
          <span
            key={`${p.name}-${i}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              color: "var(--text-dim)",
            }}
          >
            <span style={{ color: "var(--text)" }}>{p.name}</span>
            <span style={{ color: "var(--accent)" }}>{p.apy.toFixed(2)}%</span>
            <span
              style={{
                color: p.change > 0 ? "var(--good)" : "var(--danger)",
              }}
            >
              {p.change > 0 ? "▲" : "▼"} {Math.abs(p.change).toFixed(2)}
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

export default LandingTicker;
