"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import type { PortfolioSummary } from "@/types/wallet";

export function usePortfolio() {
  const { address, isConnected } = useAccount();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/portfolio/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
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

  // Auto-fetch when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      fetchPortfolio();
    } else {
      setPortfolio(null);
    }
  }, [isConnected, address, fetchPortfolio]);

  return {
    address,
    isConnected,
    portfolio,
    isLoading,
    error,
    refetch: fetchPortfolio,
  };
}
