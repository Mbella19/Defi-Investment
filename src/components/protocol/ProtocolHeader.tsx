import type { DefiLlamaProtocol } from "@/types/pool";
import type { DefiLlamaPool } from "@/types/pool";
import { formatCurrency, formatDate, formatPercentChange } from "@/lib/formatters";

interface ProtocolHeaderProps {
  protocol: DefiLlamaProtocol;
  pools: DefiLlamaPool[];
}

export default function ProtocolHeader({ protocol, pools }: ProtocolHeaderProps) {
  const change1d = formatPercentChange(protocol.change_1d);
  const change7d = formatPercentChange(protocol.change_7d);
  const apys = pools.filter((p) => p.apy).map((p) => p.apy!);
  const minApy = apys.length > 0 ? Math.min(...apys) : 0;
  const maxApy = apys.length > 0 ? Math.max(...apys) : 0;

  return (
    <section className="grid grid-cols-12 gap-8 mb-12 items-start">
      <div className="col-span-12 lg:col-span-8">
        <div className="flex items-center gap-4 mb-4">
          {protocol.logo && (
            <img
              src={protocol.logo}
              alt={protocol.name}
              className="w-12 h-12 bg-surface-highest"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div>
            <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold block">
              {protocol.category}
            </span>
            <h2 className="font-headline text-5xl md:text-6xl font-light leading-none tracking-tighter text-on-surface">
              {protocol.name}
            </h2>
          </div>
        </div>
        <p className="text-on-surface-variant text-sm leading-relaxed max-w-2xl mt-4">
          {protocol.description}
        </p>
        <div className="flex gap-4 mt-4">
          {protocol.url && (
            <a
              href={protocol.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:text-on-surface underline underline-offset-4 decoration-primary/30 transition-colors"
            >
              Website
            </a>
          )}
          {protocol.twitter && (
            <a
              href={`https://twitter.com/${protocol.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:text-on-surface underline underline-offset-4 decoration-primary/30 transition-colors"
            >
              @{protocol.twitter}
            </a>
          )}
        </div>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-4">
        <div className="bg-surface-low ghost-border p-6">
          <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">
            Total Value Locked
          </span>
          <span className="font-headline text-3xl text-on-surface block">
            {formatCurrency(protocol.tvl)}
          </span>
          <div className="flex gap-4 mt-2">
            <span className={`text-[10px] ${change1d.positive ? "text-primary" : "text-error"}`}>
              1d: {change1d.text}
            </span>
            <span className={`text-[10px] ${change7d.positive ? "text-primary" : "text-error"}`}>
              7d: {change7d.text}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[1px] bg-surface">
          <div className="bg-surface-low ghost-border p-4">
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">
              Chains
            </span>
            <span className="text-sm font-label">{protocol.chains.length}</span>
          </div>
          <div className="bg-surface-low ghost-border p-4">
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">
              Audits
            </span>
            <span className="text-sm font-label">{protocol.audits || "0"}</span>
          </div>
          <div className="bg-surface-low ghost-border p-4">
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">
              Listed Since
            </span>
            <span className="text-sm font-label">
              {protocol.listedAt ? formatDate(protocol.listedAt) : "N/A"}
            </span>
          </div>
          <div className="bg-surface-low ghost-border p-4">
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">
              APY Range
            </span>
            <span className="text-sm font-label">
              {minApy.toFixed(1)}% - {maxApy.toFixed(1)}%
            </span>
          </div>
        </div>

        {protocol.audit_links && protocol.audit_links.length > 0 && (
          <div className="bg-surface-low ghost-border p-4">
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
              Audit Reports
            </span>
            {protocol.audit_links.map((link, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-primary hover:text-on-surface underline underline-offset-4 decoration-primary/30 block mb-1 transition-colors"
              >
                Audit Report {i + 1}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
