"use client";

import { useChains } from "@/hooks/useChains";
import { formatCurrency } from "@/lib/formatters";

interface ChainSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export default function ChainSelector({ value, onChange }: ChainSelectorProps) {
  const { chains, isLoading } = useChains();

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-2 bg-[#00D4AA]" />
        <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
          Network
        </label>
      </div>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full bg-white border border-[#d7dade] text-sm text-[#203241] px-4 py-3 focus:border-[#00D4AA] transition-all duration-300 outline-none appearance-none cursor-pointer hover:border-[#00D4AA]/30"
      >
        <option value="">All Networks</option>
        {isLoading ? (
          <option disabled>Loading chains...</option>
        ) : (
          chains.map((chain) => (
            <option key={chain.name} value={chain.name}>
              {chain.name} ({formatCurrency(chain.tvl)})
            </option>
          ))
        )}
      </select>
    </div>
  );
}
