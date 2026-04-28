"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StrategyAlert } from "@/types/active-strategy";
import { useSiweAuth } from "@/hooks/useSiweAuth";

const POLL_INTERVAL = 60_000; // 60 seconds

/**
 * Live alert feed against /api/strategies/alerts. Authentication is the
 * `sov_session` cookie set by the SIWE flow — no `?wallet=` query param
 * needed (the route ignores it). When SIWE hasn't completed we don't poll;
 * once authed we fetch immediately and then every 60s.
 */
export function useStrategyAlerts() {
  const { status } = useSiweAuth();
  const isAuthed = status === "authed";

  const [alerts, setAlerts] = useState<StrategyAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Initialize true so the first paint shows the loading state without
  // having to setState synchronously inside the mount effect (cascading-
  // render lint rule).
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!isAuthed) {
      setAlerts([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch("/api/strategies/alerts?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setAlerts(data.alerts);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silently fail on poll errors
    }
  }, [isAuthed]);

  // Initial fetch + polling, only while authed.
  useEffect(() => {
    let cancelled = false;
    const initial = setTimeout(() => {
      void fetchAlerts().finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    }, 0);

    if (isAuthed) {
      intervalRef.current = setInterval(fetchAlerts, POLL_INTERVAL);
    }
    return () => {
      cancelled = true;
      clearTimeout(initial);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAlerts, isAuthed]);

  const markRead = useCallback(
    async (alertIds: string[]) => {
      await fetch("/api/strategies/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertIds }),
      });
      await fetchAlerts();
    },
    [fetchAlerts],
  );

  const markAllRead = useCallback(async () => {
    await fetch("/api/strategies/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    await fetchAlerts();
  }, [fetchAlerts]);

  return {
    alerts,
    unreadCount,
    isLoading,
    isAuthed,
    refetch: fetchAlerts,
    markRead,
    markAllRead,
  };
}
