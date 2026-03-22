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
          <div className="bg-error-container/20 border-l-2 border-error p-4">
            <p className="text-error text-sm">{error}</p>
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
        <div className="bg-surface-lowest p-8 border-l-4 border-primary sticky top-20">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-6 block">
            Scan Parameters
          </span>

          <div className="space-y-6">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">
                Budget
              </span>
              <span className="font-headline text-3xl text-on-surface">
                {formatBudget(budget)}
              </span>
            </div>

            <div>
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">
                Risk Profile
              </span>
              <span className="font-headline text-lg text-primary">{riskInfo.label}</span>
              <span className="text-[11px] text-on-surface-variant block mt-1">
                {riskInfo.apyRange} APY target
              </span>
            </div>

            <div>
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">
                Assets
              </span>
              <span className="text-sm text-on-surface">
                {assetType === "stablecoins" ? "Stablecoins Only" : "All Assets"}
              </span>
            </div>

            <div>
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-1">
                Network
              </span>
              <span className="text-sm text-on-surface">{chain || "All Networks"}</span>
            </div>

            <div className="border-t border-outline-variant/10 pt-6">
              <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold block mb-2">
                Filter Preview
              </span>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
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
