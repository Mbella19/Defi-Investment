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
              className="w-12 h-12 bg-[#f2f3f5] border border-[#d7dade]"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-2 bg-[#ff6c12]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
                {protocol.category}
              </span>
            </div>
            <h2 className="font-headline text-5xl md:text-6xl font-black leading-none tracking-tighter text-[#203241]">
              {protocol.name}
            </h2>
          </div>
        </div>
        <p className="text-[#6b7781] text-sm leading-relaxed max-w-2xl mt-4">
          {protocol.description}
        </p>
        <div className="flex gap-4 mt-4">
          {protocol.url && (
            <a
              href={protocol.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#ff6c12] hover:text-[#ff6c12]/80 underline underline-offset-4 decoration-[#ff6c12]/30 transition-all duration-300"
            >
              Website
            </a>
          )}
          {protocol.twitter && (
            <a
              href={`https://twitter.com/${protocol.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#ff6c12] hover:text-[#ff6c12]/80 underline underline-offset-4 decoration-[#ff6c12]/30 transition-all duration-300"
            >
              @{protocol.twitter}
            </a>
          )}
        </div>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-4">
        <div className="bg-[#f2f3f5] border border-[#d7dade] p-8 transition-all duration-300 hover:border-[#00D4AA]/30">
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-1">
            Total Value Locked
          </span>
          <span className="font-headline text-4xl font-black text-[#00D4AA] block">
            {formatCurrency(protocol.tvl)}
          </span>
          <div className="flex gap-4 mt-2">
            <span className={`text-[10px] ${change1d.positive ? "text-[#00896e]" : "text-[#ff4d4d]"}`}>
              1d: {change1d.text}
            </span>
            <span className={`text-[10px] ${change7d.positive ? "text-[#00896e]" : "text-[#ff4d4d]"}`}>
              7d: {change7d.text}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#f2f3f5] border border-[#d7dade] p-4 transition-all duration-300 hover:border-[#00D4AA]/30">
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-1">
              Chains
            </span>
            <span className="text-sm text-[#43515d]">{protocol.chains.length}</span>
          </div>
          <div className="bg-[#f2f3f5] border border-[#d7dade] p-4 transition-all duration-300 hover:border-[#00D4AA]/30">
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-1">
              Audits
            </span>
            <span className="text-sm text-[#43515d]">{protocol.audits || "0"}</span>
          </div>
          <div className="bg-[#f2f3f5] border border-[#d7dade] p-4 transition-all duration-300 hover:border-[#00D4AA]/30">
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-1">
              Listed Since
            </span>
            <span className="text-sm text-[#43515d]">
              {protocol.listedAt ? formatDate(protocol.listedAt) : "N/A"}
            </span>
          </div>
          <div className="bg-[#f2f3f5] border border-[#d7dade] p-4 transition-all duration-300 hover:border-[#00D4AA]/30">
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-1">
              APY Range
            </span>
            <span className="text-sm text-[#43515d]">
              {minApy.toFixed(1)}% - {maxApy.toFixed(1)}%
            </span>
          </div>
        </div>

        {protocol.audit_links && protocol.audit_links.length > 0 && (
          <div className="bg-[#f2f3f5] border border-[#d7dade] p-8 transition-all duration-300 hover:border-[#00D4AA]/30">
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-2">
              Audit Reports
            </span>
            {protocol.audit_links.map((link, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#ff6c12] hover:text-[#ff6c12]/80 underline underline-offset-4 decoration-[#ff6c12]/30 block mb-1 transition-all duration-300"
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
