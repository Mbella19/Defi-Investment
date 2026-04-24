export type ChainId = "eth" | "arb" | "op" | "base" | "sol" | "poly";

type ChainMeta = { label: string; short: string; color: string };

export const CHAINS: Record<ChainId, ChainMeta> = {
  eth: { label: "Ethereum", short: "ETH", color: "var(--c-eth)" },
  arb: { label: "Arbitrum", short: "ARB", color: "var(--c-arb)" },
  op: { label: "Optimism", short: "OP", color: "var(--c-op)" },
  base: { label: "Base", short: "BASE", color: "var(--c-base)" },
  sol: { label: "Solana", short: "SOL", color: "var(--c-sol)" },
  poly: { label: "Polygon", short: "POLY", color: "var(--c-poly)" },
};

function resolveChain(id: string): ChainMeta {
  const key = id.toLowerCase() as ChainId;
  if (CHAINS[key]) return CHAINS[key];
  if (key.startsWith("eth")) return CHAINS.eth;
  if (key.startsWith("arb")) return CHAINS.arb;
  if (key.startsWith("op") || key.startsWith("optim")) return CHAINS.op;
  if (key.startsWith("base")) return CHAINS.base;
  if (key.startsWith("sol")) return CHAINS.sol;
  if (key.startsWith("poly") || key.startsWith("matic")) return CHAINS.poly;
  const upper = id.slice(0, 4).toUpperCase();
  return { label: id, short: upper, color: "var(--text-2)" };
}

type Props = {
  id: string;
  size?: number;
  label?: boolean;
};

export function ChainGlyph({ id, size = 20, label = true }: Props) {
  const c = resolveChain(id);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--text-1)",
        minWidth: 0,
      }}
    >
      <span
        className="mono"
        style={{
          width: size,
          height: size,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.42,
          fontWeight: 600,
          letterSpacing: 0,
          background: `color-mix(in oklch, ${c.color} 16%, transparent)`,
          color: c.color,
          border: `1px solid color-mix(in oklch, ${c.color} 32%, transparent)`,
          borderRadius: 6,
          flexShrink: 0,
        }}
      >
        {c.short[0]}
      </span>
      {label ? <span style={{ whiteSpace: "nowrap" }}>{c.label}</span> : null}
    </span>
  );
}

export default ChainGlyph;
