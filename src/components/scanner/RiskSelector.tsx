"use client";

import type { RiskAppetite } from "@/types/scanner";
import { getRiskDescription } from "@/lib/risk";

interface RiskSelectorProps {
  value: RiskAppetite;
  onChange: (value: RiskAppetite) => void;
}

const risks: RiskAppetite[] = ["low", "medium", "high"];

export default function RiskSelector({ value, onChange }: RiskSelectorProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-2 bg-[#ff4d4d]" />
        <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
          Risk Appetite
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {risks.map((risk) => {
          const info = getRiskDescription(risk);
          const isActive = value === risk;

          return (
            <button
              key={risk}
              onClick={() => onChange(risk)}
              className={`
                group p-6 text-left transition-all duration-300 border
                ${
                  isActive
                    ? "bg-[#00D4AA]/5 border-[#00D4AA]"
                    : "bg-white border-[#d7dade] hover:-translate-y-0.5 hover:border-[#00D4AA]/30"
                }
              `}
            >
              <span
                className={`
                  text-[11px] tracking-[0.2em] uppercase font-semibold block mb-3
                  ${isActive ? "text-[#00D4AA]" : "text-[#45515d]/70 group-hover:text-[#43515d]"}
                `}
              >
                {info.label}
              </span>
              <span className="text-lg font-black tracking-[-0.05em] block mb-3 text-[#203241]">
                {info.apyRange} APY
              </span>
              <span className="text-[11px] text-[#6b7781] leading-relaxed block">
                {info.description}
              </span>
              <span className="text-[10px] text-[#45515d]/70 mt-3 block tracking-[0.1em] uppercase">
                Min TVL: {info.minTvl}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
