"use client";

import type { AssetType } from "@/types/scanner";

interface AssetTypeToggleProps {
  value: AssetType;
  onChange: (value: AssetType) => void;
}

export default function AssetTypeToggle({ value, onChange }: AssetTypeToggleProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-2 bg-accent" />
        <label className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
          Asset Class
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onChange("stablecoins")}
          className={`
            group px-6 py-5 text-[13px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 text-left
            ${
              value === "stablecoins"
                ? "bg-btn text-white"
                : "bg-surface-container text-on-surface-variant hover:-translate-y-0.5 hover:bg-btn hover:text-white"
            }
          `}
        >
          <span className="material-symbols-outlined text-sm block mb-2">toll</span>
          Stablecoins Only
        </button>
        <button
          onClick={() => onChange("all")}
          className={`
            group px-6 py-5 text-[13px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 text-left
            ${
              value === "all"
                ? "bg-btn text-white"
                : "bg-surface-container text-on-surface-variant hover:-translate-y-0.5 hover:bg-btn hover:text-white"
            }
          `}
        >
          <span className="material-symbols-outlined text-sm block mb-2">token</span>
          All Assets
        </button>
      </div>
    </div>
  );
}
