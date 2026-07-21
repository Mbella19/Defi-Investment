"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import type { PortfolioSummary } from "@/types/wallet";
import { apiFetch } from "@/lib/api-client";

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
      const res = await apiFetch("/api/portfolio/balances", {
        method: "POST",
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
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (isConnected && address) {
        void fetchPortfolio();
      } else {
        setPortfolio(null);
      }
    });
    return () => {
      cancelled = true;
    };
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
