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
    <div className="space-y-4">
      <label className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block">
        Risk Appetite
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[1px] bg-surface">
        {risks.map((risk) => {
          const info = getRiskDescription(risk);
          const isActive = value === risk;

          return (
            <button
              key={risk}
              onClick={() => onChange(risk)}
              className={`
                p-6 text-left transition-all duration-300
                ${
                  isActive
                    ? "bg-surface-high border-l-2 border-primary"
                    : "bg-surface-low hover:bg-surface-container border-l-2 border-transparent"
                }
              `}
            >
              <span
                className={`
                  text-[10px] uppercase tracking-widest font-bold block mb-2
                  ${isActive ? "text-primary" : "text-on-surface-variant"}
                `}
              >
                {info.label}
              </span>
              <span className="font-headline text-lg block mb-2 text-on-surface">
                {info.apyRange} APY
              </span>
              <span className="text-[11px] text-on-surface-variant leading-relaxed block">
                {info.description}
              </span>
              <span className="text-[10px] text-on-surface-variant mt-2 block">
                Min TVL: {info.minTvl}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
