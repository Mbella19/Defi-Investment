"use client";

import { useState, useCallback } from "react";
import type { PortfolioSummary } from "@/types/wallet";

const DEMO_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18";

export function usePastedWallet() {
  const [address, setAddress] = useState(
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? DEMO_ADDRESS : ""
  );
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(address);

  const fetchPortfolio = useCallback(async (addr?: string) => {
    const targetAddress = addr || address;
    if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
      setError("Invalid Ethereum address");
      return;
    }

    setIsLoading(true);
    setError(null);
    setPortfolio(null);

    try {
      const res = await fetch("/api/portfolio/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddress }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch portfolio");
      }

      const data: PortfolioSummary = await res.json();
      setPortfolio(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch portfolio");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const reset = useCallback(() => {
    setAddress("");
    setPortfolio(null);
    setError(null);
  }, []);

  return {
    address,
    setAddress,
    isValidAddress,
    portfolio,
    isLoading,
    error,
    fetchPortfolio,
    reset,
  };
}
