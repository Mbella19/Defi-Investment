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
    <div className="space-y-4">
      <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block">
        Network
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full bg-surface-lowest border-b border-outline-variant/30 text-sm py-3 px-4 focus:border-primary transition-colors outline-none font-label text-on-surface appearance-none cursor-pointer"
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
