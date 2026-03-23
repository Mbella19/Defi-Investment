"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StrategyAlert } from "@/types/active-strategy";

const POLL_INTERVAL = 60_000; // 60 seconds

export function useStrategyAlerts(walletAddress?: string | null) {
  const [alerts, setAlerts] = useState<StrategyAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (walletAddress) params.set("wallet", walletAddress);
      const res = await fetch(`/api/strategies/alerts?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setAlerts(data.alerts);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silently fail on poll errors
    }
  }, [walletAddress]);

  // Initial fetch + polling
  useEffect(() => {
    setIsLoading(true);
    fetchAlerts().finally(() => setIsLoading(false));

    intervalRef.current = setInterval(fetchAlerts, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAlerts]);

  const markRead = useCallback(async (alertIds: string[]) => {
    await fetch("/api/strategies/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertIds }),
    });
    await fetchAlerts();
  }, [fetchAlerts]);

  const markAllRead = useCallback(async () => {
    await fetch("/api/strategies/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true, wallet: walletAddress }),
    });
    await fetchAlerts();
  }, [walletAddress, fetchAlerts]);

  return {
    alerts,
    unreadCount,
    isLoading,
    refetch: fetchAlerts,
    markRead,
    markAllRead,
  };
}
