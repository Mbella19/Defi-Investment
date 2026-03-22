"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RiskAppetite, AssetType } from "@/types/scanner";

export function useScanner() {
  const router = useRouter();
  const [budget, setBudget] = useState<number>(10000);
  const [riskAppetite, setRiskAppetite] = useState<RiskAppetite>("low");
  const [assetType, setAssetType] = useState<AssetType>("stablecoins");
  const [chain, setChain] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setIsScanning(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        budget: budget.toString(),
        risk: riskAppetite,
        asset: assetType,
      });
      if (chain) params.set("chain", chain);

      router.push(`/results?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setIsScanning(false);
    }
  };

  return {
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
  };
}
