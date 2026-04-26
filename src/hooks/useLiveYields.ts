"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveYieldsPayload } from "@/app/api/yields/live/route";

const POLL_INTERVAL_MS = 60_000;

interface State {
  data: LiveYieldsPayload | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
}

export function useLiveYields(): State {
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: null,
    fetchedAt: null,
  });
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      try {
        const res = await fetch("/api/yields/live", { cache: "no-store" });
        const json = await res.json();
        if (cancelled.current) return;
        if (!res.ok) {
          setState((s) => ({ ...s, loading: false, error: json?.error ?? `HTTP ${res.status}` }));
        } else {
          setState({
            data: json as LiveYieldsPayload,
            loading: false,
            error: null,
            fetchedAt: Date.now(),
          });
        }
      } catch (err) {
        if (cancelled.current) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "fetch failed",
        }));
      } finally {
        if (!cancelled.current) {
          timer = setTimeout(load, POLL_INTERVAL_MS);
        }
      }
    }

    load();
    return () => {
      cancelled.current = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return state;
}

export function formatRefreshAge(fetchedAt: number | null): string {
  if (!fetchedAt) return "just now";
  const ageSec = Math.max(0, Math.floor((Date.now() - fetchedAt) / 1000));
  if (ageSec < 5) return "just now";
  if (ageSec < 60) return `${ageSec}s ago`;
  const min = Math.floor(ageSec / 60);
  return `${min}m ago`;
}

export function formatTvl(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "—";
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}
