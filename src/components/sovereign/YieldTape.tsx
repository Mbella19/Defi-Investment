import { ChainGlyph } from "./ChainGlyph";

export type TapeRow = {
  pool: string;
  protocol: string;
  chain: string;
  apy: number;
  d: number;
};

const DEFAULT_TAPE: TapeRow[] = [
  { pool: "USDC", protocol: "Aave v3", chain: "eth", apy: 5.14, d: 0.12 },
  { pool: "stETH", protocol: "Lido", chain: "eth", apy: 3.22, d: -0.04 },
  { pool: "sDAI", protocol: "Spark", chain: "eth", apy: 8.75, d: 0.31 },
  { pool: "USDC", protocol: "Morpho", chain: "base", apy: 6.41, d: 0.08 },
  { pool: "ETH", protocol: "Pendle PT", chain: "arb", apy: 12.04, d: 0.55 },
  { pool: "rETH", protocol: "Rocket", chain: "eth", apy: 3.08, d: 0.02 },
  { pool: "GHO", protocol: "Aave v3", chain: "arb", apy: 7.2, d: -0.15 },
  { pool: "wstETH/WETH", protocol: "Balancer", chain: "op", apy: 4.9, d: 0.06 },
  { pool: "USDe", protocol: "Ethena", chain: "eth", apy: 14.6, d: -0.42 },
];

type Props = {
  rows?: TapeRow[];
};

export function YieldTape({ rows = DEFAULT_TAPE }: Props) {
  const doubled = [...rows, ...rows];
  return (
    <div
      style={{
        overflow: "hidden",
        width: "100%",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          animation: "marquee 80s linear infinite",
          width: "max-content",
          whiteSpace: "nowrap",
        }}
      >
        {doubled.map((r, i) => (
          <div
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "0 22px",
              height: 42,
              borderRight: "1px solid var(--line)",
            }}
          >
            <ChainGlyph id={r.chain} size={16} label={false} />
            <span className="mono" style={{ fontSize: 11.5, color: "var(--text-1)", fontWeight: 500 }}>
              {r.pool}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{r.protocol}</span>
            <span className="num" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
              {r.apy.toFixed(2)}%
            </span>
            <span className={r.d >= 0 ? "delta-up" : "delta-dn"} style={{ fontSize: 10.5 }}>
              {r.d >= 0 ? "▲" : "▼"} {Math.abs(r.d).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default YieldTape;
