"use client";

import type { AssetType } from "@/types/scanner";

interface AssetTypeToggleProps {
  value: AssetType;
  onChange: (value: AssetType) => void;
}

export default function AssetTypeToggle({ value, onChange }: AssetTypeToggleProps) {
  return (
    <div className="space-y-4">
      <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block">
        Asset Class
      </label>
      <div className="flex gap-[1px] bg-surface">
        <button
          onClick={() => onChange("stablecoins")}
          className={`
            flex-1 px-6 py-4 text-[11px] font-bold uppercase tracking-widest transition-all duration-200
            ${
              value === "stablecoins"
                ? "bg-surface-high text-primary border-b-2 border-primary"
                : "bg-surface-low text-on-surface-variant hover:text-on-surface border-b-2 border-transparent"
            }
          `}
        >
          <span className="material-symbols-outlined text-sm block mb-1">toll</span>
          Stablecoins Only
        </button>
        <button
          onClick={() => onChange("all")}
          className={`
            flex-1 px-6 py-4 text-[11px] font-bold uppercase tracking-widest transition-all duration-200
            ${
              value === "all"
                ? "bg-surface-high text-primary border-b-2 border-primary"
                : "bg-surface-low text-on-surface-variant hover:text-on-surface border-b-2 border-transparent"
            }
          `}
        >
          <span className="material-symbols-outlined text-sm block mb-1">token</span>
          All Assets
        </button>
      </div>
    </div>
  );
}
