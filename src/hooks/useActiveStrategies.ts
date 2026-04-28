"use client";

import { useState, useEffect, useCallback } from "react";
import type { ActiveStrategy, StrategyAlert } from "@/types/active-strategy";
import type { InvestmentStrategy, StrategyCriteria } from "@/types/strategy";
import { useSiweAuth } from "@/hooks/useSiweAuth";

/**
 * Strategy CRUD against the wallet-scoped /api/strategies routes. The auth
 * boundary is the `sov_session` cookie set by SIWE — passing `?wallet=…` in
 * the URL is a no-op (the route ignores it). When the SIWE flow hasn't
 * completed yet we keep the list empty rather than fire a 401.
 */
export function useActiveStrategies() {
  const { status, authedWallet } = useSiweAuth();
  const isAuthed = status === "authed" && !!authedWallet;

  const [strategies, setStrategies] = useState<ActiveStrategy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategies = useCallback(async () => {
    if (!isAuthed) {
      setStrategies([]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/strategies");
      if (res.status === 401) {
        // Session expired or never minted. Hand back to the auth flow rather
        // than burning the user with a misleading "fetch failed" toast.
        setStrategies([]);
        setError("Sign in to view your strategies");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch strategies");
      const data = await res.json();
      setStrategies(data.strategies);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch strategies");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  const activateStrategy = useCallback(
    async (strategy: InvestmentStrategy, criteria: StrategyCriteria) => {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, criteria }),
      });
      if (!res.ok) throw new Error("Failed to activate strategy");
      const data = await res.json();
      // Activation only registers the strategy for monitoring — it does NOT
      // record a deposit. The user has not actually moved funds; they've asked
      // us to watch the protocols for trouble.
      await fetchStrategies();
      return data;
    },
    [fetchStrategies],
  );

  const updateStatus = useCallback(
    async (id: string, status: "active" | "paused" | "archived") => {
      const res = await fetch(`/api/strategies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update strategy");
      await fetchStrategies();
    },
    [fetchStrategies],
  );

  const deleteStrategy = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/strategies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete strategy");
      await fetchStrategies();
    },
    [fetchStrategies],
  );

  const runScan = useCallback(
    async (strategyId?: string) => {
      const res = await fetch("/api/strategies/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId }),
      });
      if (!res.ok) throw new Error("Monitor scan failed");
      const data = await res.json();
      await fetchStrategies();
      return data as { scanned: number; newAlerts: StrategyAlert[] };
    },
    [fetchStrategies],
  );

  return {
    strategies,
    isLoading,
    error,
    isAuthed,
    refetch: fetchStrategies,
    activateStrategy,
    updateStatus,
    deleteStrategy,
    runScan,
  };
}
