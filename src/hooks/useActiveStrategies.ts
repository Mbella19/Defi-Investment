"use client";

import { useState, useEffect, useCallback } from "react";
import type { ActiveStrategy, StrategyAlert } from "@/types/active-strategy";
import type { InvestmentStrategy, StrategyCriteria } from "@/types/strategy";

export function useActiveStrategies(walletAddress?: string | null) {
  const [strategies, setStrategies] = useState<ActiveStrategy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = walletAddress ? `?wallet=${walletAddress}` : "";
      const res = await fetch(`/api/strategies${params}`);
      if (!res.ok) throw new Error("Failed to fetch strategies");
      const data = await res.json();
      setStrategies(data.strategies);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch strategies");
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  const activateStrategy = useCallback(async (
    strategy: InvestmentStrategy,
    criteria: StrategyCriteria,
    wallet?: string,
  ) => {
    const res = await fetch("/api/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy, criteria, walletAddress: wallet }),
    });
    if (!res.ok) throw new Error("Failed to activate strategy");
    const data = await res.json();
    await fetchStrategies();
    return data;
  }, [fetchStrategies]);

  const updateStatus = useCallback(async (id: string, status: "active" | "paused" | "archived") => {
    const res = await fetch(`/api/strategies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update strategy");
    await fetchStrategies();
  }, [fetchStrategies]);

  const deleteStrategy = useCallback(async (id: string) => {
    const res = await fetch(`/api/strategies/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete strategy");
    await fetchStrategies();
  }, [fetchStrategies]);

  const runScan = useCallback(async (strategyId?: string) => {
    const res = await fetch("/api/strategies/monitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategyId }),
    });
    if (!res.ok) throw new Error("Monitor scan failed");
    const data = await res.json();
    await fetchStrategies();
    return data as { scanned: number; newAlerts: StrategyAlert[] };
  }, [fetchStrategies]);

  return {
    strategies,
    isLoading,
    error,
    refetch: fetchStrategies,
    activateStrategy,
    updateStatus,
    deleteStrategy,
    runScan,
  };
}
