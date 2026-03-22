"use client";

import { useScanner } from "@/hooks/useScanner";
import BudgetInput from "./BudgetInput";
import RiskSelector from "./RiskSelector";
import AssetTypeToggle from "./AssetTypeToggle";
import ChainSelector from "./ChainSelector";
import SovereignButton from "@/components/ui/SovereignButton";
import { formatBudget } from "@/lib/formatters";
import { getRiskDescription } from "@/lib/risk";
import { RISK_PROFILES } from "@/lib/risk";

export default function ScannerForm() {
  const {
    budget,
    setBudget,
    riskAppetite,
    setRiskAppetite,
    assetType,
    setAssetType,
    chain,
    setChain,
    isScanning,
    error,
    submit,
  } = useScanner();

  const riskInfo = getRiskDescription(riskAppetite);
  const profile = RISK_PROFILES[riskAppetite];

  return (
    <div className="grid grid-cols-12 gap-8">
      {/* Form */}
      <div className="col-span-12 lg:col-span-8 space-y-10">
        <BudgetInput value={budget} onChange={setBudget} />
        <RiskSelector value={riskAppetite} onChange={setRiskAppetite} />
        <AssetTypeToggle value={assetType} onChange={setAssetType} />
        <ChainSelector value={chain} onChange={setChain} />

        {error && (
          <div className="bg-[#ff4d4d]/10 border border-[#ff4d4d]/20 p-6">
            <p className="text-[#ff4d4d] text-sm">{error}</p>
          </div>
        )}

        <SovereignButton
          onClick={submit}
          disabled={isScanning || budget <= 0}
          icon="radar"
          className="w-full py-4 text-sm"
        >
          {isScanning ? "Scanning DeFi Protocols..." : "Scan DeFi Yields"}
        </SovereignButton>
      </div>

      {/* Live Summary Sidebar */}
      <div className="col-span-12 lg:col-span-4">
        <div className="bg-[#f2f3f5] border border-[#d7dade] p-10 sticky top-20 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#00D4AA]/30">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-2 bg-[#00D4AA]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
              Scan Parameters
            </span>
          </div>

          <div className="space-y-8">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-2">
                Budget
              </span>
              <span className="text-3xl font-black tracking-[-0.05em] text-[#203241]">
                {formatBudget(budget)}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-2">
                Risk Profile
              </span>
              <span className="text-lg font-black tracking-[-0.05em] text-[#00D4AA]">{riskInfo.label}</span>
              <span className="text-[11px] text-[#6b7781] block mt-1">
                {riskInfo.apyRange} APY target
              </span>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-2">
                Assets
              </span>
              <span className="text-sm text-[#203241]">
                {assetType === "stablecoins" ? "Stablecoins Only" : "All Assets"}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-2">
                Network
              </span>
              <span className="text-sm text-[#203241]">{chain || "All Networks"}</span>
            </div>

            <div className="border-t border-[#d7dade] pt-8">
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70 block mb-3">
                Filter Preview
              </span>
              <p className="text-[11px] text-[#6b7781] leading-relaxed">
                Scanning for {assetType === "stablecoins" ? "stablecoin" : "all"} pools
                {chain ? ` on ${chain}` : " across all networks"} with{" "}
                {`>`}${formatBudget(profile.minTvl)} TVL, targeting {riskInfo.apyRange} APY
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
