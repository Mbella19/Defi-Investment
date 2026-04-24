export const fmt = {
  money(n: number): string {
    if (!Number.isFinite(n)) return "$0";
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  },
  pct(n: number, decimals = 2): string {
    if (!Number.isFinite(n)) return "—";
    return `${n > 0 ? "+" : ""}${n.toFixed(decimals)}%`;
  },
  apy(n: number, decimals = 2): string {
    if (!Number.isFinite(n)) return "—";
    return `${n.toFixed(decimals)}%`;
  },
  dollar(n: number): string {
    if (!Number.isFinite(n)) return "$0";
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  },
  compact(n: number): string {
    if (!Number.isFinite(n)) return "0";
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
    return `${sign}${abs.toFixed(0)}`;
  },
};

export default fmt;
