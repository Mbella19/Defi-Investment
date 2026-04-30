"use client";

import { useCallback, useEffect, useState } from "react";
import { useSiweAuth } from "./useSiweAuth";

export type Tier = "free" | "pro" | "ultra";
export type StrategistMode = "solo" | "dual" | "council";

export interface PlanCapabilities {
  monthlyStrategies: number;
  strategistMode: StrategistMode;
  riskBandSelection: boolean;
  stablecoinToggle: boolean;
  realtimeAlerts: boolean;
  customApyMode: boolean;
  toolSimulator: boolean;
  toolCorrelation: boolean;
  toolPortfolioLens: boolean;
  toolAudit: boolean;
  alertChannels: string[];
  prioritySupport: boolean;
}

export interface PlanState {
  tier: Tier;
  capabilities: PlanCapabilities;
  isOwner: boolean;
  wallet: string | null;
  expiresAt: string | null;
  prices: Record<Tier, number>;
  usage: { strategiesThisMonth: number };
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const FREE_DEFAULT: PlanState = {
  tier: "free",
  capabilities: {
    monthlyStrategies: 2,
    strategistMode: "solo",
    riskBandSelection: false,
    stablecoinToggle: false,
    realtimeAlerts: false,
    customApyMode: false,
    toolSimulator: false,
    toolCorrelation: false,
    toolPortfolioLens: false,
    toolAudit: true,
    alertChannels: [],
    prioritySupport: false,
  },
  isOwner: false,
  wallet: null,
  expiresAt: null,
  prices: { free: 0, pro: 100, ultra: 200 },
  usage: { strategiesThisMonth: 0 },
  isLoading: true,
  error: null,
  refetch: async () => {},
};

export function usePlan(): PlanState {
  const { status: authStatus } = useSiweAuth();
  const [state, setState] = useState<PlanState>(FREE_DEFAULT);

  const fetchPlan = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch("/api/me/plan", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Plan fetch failed (${res.status})`);
      }
      const data = (await res.json()) as Omit<PlanState, "isLoading" | "error" | "refetch">;
      setState((s) => ({ ...s, ...data, isLoading: false, error: null }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Plan fetch failed";
      setState((s) => ({ ...s, isLoading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    void fetchPlan();
  }, [fetchPlan, authStatus]);

  return { ...state, refetch: fetchPlan };
}
