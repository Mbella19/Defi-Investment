type PoolIconKind = "stable" | "eth" | "btc" | "lp" | "yield";

function poolIconKind({
  symbol,
  protocol,
  category,
}: {
  symbol: string;
  protocol?: string;
  category?: string;
}): PoolIconKind {
  const s = symbol.toUpperCase();
  const p = (protocol ?? "").toLowerCase();
  const c = (category ?? "").toLowerCase();

  if (s.includes("BTC")) return "btc";
  if (
    s.includes("ETH") ||
    s.includes("STETH") ||
    s.includes("RETH") ||
    s.includes("WEETH") ||
    s.includes("WBETH") ||
    p.includes("rocket")
  ) {
    return "eth";
  }
  if (
    s.includes("USD") ||
    s.includes("DAI") ||
    s.includes("GHO") ||
    s.includes("FRAX") ||
    s.includes("PYUSD") ||
    s.includes("USYC") ||
    s.includes("SUSDS") ||
    c.includes("lending")
  ) {
    return "stable";
  }
  if (s.includes("/") || s.includes("-") || s.includes(" LP") || c === "lp") return "lp";
  return "yield";
}

function IconGlyph({ kind }: { kind: PoolIconKind }) {
  if (kind === "stable") {
    return (
      <>
        <circle cx="24" cy="24" r="13" className="pool-icon-fill" />
        <path d="M24 14v20M18 20c1.7-2.3 9.9-2.8 11 1.2 1.4 5.2-10.7 3.2-10.2 8.3.4 4.4 9 3.7 11.4 1.2" />
      </>
    );
  }

  if (kind === "eth") {
    return (
      <>
        <path className="pool-icon-fill" d="M24 7 12 26l12 7 12-7L24 7Z" />
        <path d="M24 7v26M12 26l12-5 12 5M12 30l12 11 12-11" />
      </>
    );
  }

  if (kind === "btc") {
    return (
      <>
        <circle cx="24" cy="24" r="14" className="pool-icon-fill" />
        <path d="M21 13v22M27 13v22M18 17h8.5c4.5 0 5.4 6 1 7 5.2.8 4.7 7-1 7H18" />
      </>
    );
  }

  if (kind === "lp") {
    return (
      <>
        <circle cx="20" cy="25" r="11" className="pool-icon-fill pool-icon-fill-soft" />
        <circle cx="30" cy="20" r="11" className="pool-icon-fill" />
        <path d="M14 33c4.8 4.2 14.6 4.2 20 0M18 20h14M18 25h14" />
      </>
    );
  }

  return (
    <>
      <path className="pool-icon-fill" d="M12 35h7V24h7v6h7V15h7v20H12Z" />
      <path d="M12 25h9l6-7 6 5 8-11M41 12v8h-8" />
    </>
  );
}

export function PoolIcon({
  symbol,
  protocol,
  category,
}: {
  symbol: string;
  protocol?: string;
  category?: string;
}) {
  const kind = poolIconKind({ symbol, protocol, category });

  return (
    <span className={`token-chip pool-icon pool-icon-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" focusable="false">
        <rect x="3" y="3" width="42" height="42" rx="6" className="pool-icon-frame" />
        <IconGlyph kind={kind} />
        <rect x="34" y="8" width="5" height="5" className="pool-icon-pixel-one" />
        <rect x="9" y="35" width="4" height="4" className="pool-icon-pixel-two" />
      </svg>
    </span>
  );
}
