"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icons } from "./Icons";
import type { InvestmentStrategy, StrategyCriteria } from "@/types/strategy";
import { getDepositUrl } from "@/lib/deposit-url";
import { useActiveStrategies } from "@/hooks/useActiveStrategies";
import {
  customizeStrategy,
  makeDefaultPicks,
  normalizePicks,
  totalIncludedPercent,
  type AllocationPick,
} from "@/lib/strategy-customize";

const DRAFT_STORAGE_KEY = "sovereign:ai-strategy-draft:v2";

type RiskBand = "Safe" | "Balanced" | "Opportunistic" | "Custom";
type LegacyRiskBand = RiskBand | "Degen";

interface PersistedDraft {
  budget: number;
  risk: LegacyRiskBand;
  stablesOnly: boolean;
  customApyMin: number;
  customApyMax: number;
  result: InvestmentStrategy;
  picks: AllocationPick[];
}

function loadDraft(): PersistedDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDraft;
    if (!parsed?.result || !Array.isArray(parsed.result.allocations)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(draft: PersistedDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* quota or private mode — silently ignore */
  }
}

function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function normalizeRiskBand(raw: LegacyRiskBand | undefined): RiskBand {
  if (raw === "Degen") return "Opportunistic";
  if (raw === "Safe" || raw === "Balanced" || raw === "Opportunistic" || raw === "Custom") {
    return raw;
  }
  return "Balanced";
}

type Props = {
  open: boolean;
  onClose: () => void;
  initialBudget?: number;
  initialRisk?: RiskBand;
};

type ProgressEvent = {
  ts: number;
  stage: string;
  message: string;
  sub?: { done: number; total: number };
};

type ProgressState = {
  percent: number;
  stage: string;
  message: string;
  sub?: { done: number; total: number };
  elapsedMs: number;
  events: ProgressEvent[];
};

const INITIAL_PROGRESS: ProgressState = {
  percent: 0,
  stage: "starting",
  message: "Preparing allocation workflow...",
  elapsedMs: 0,
  events: [],
};

const CUSTOM_DEFAULT_MIN = 5;
const CUSTOM_DEFAULT_MAX = 15;

function riskToApi(
  r: RiskBand,
  customMin?: number,
  customMax?: number,
): StrategyCriteria["riskAppetite"] {
  if (r === "Safe") return "low";
  if (r === "Opportunistic") return "high";
  if (r === "Custom") {
    const mid = ((customMin ?? CUSTOM_DEFAULT_MIN) + (customMax ?? CUSTOM_DEFAULT_MAX)) / 2;
    if (mid <= 8) return "low";
    if (mid >= 18) return "high";
    return "medium";
  }
  return "medium";
}

function apyRange(
  r: RiskBand,
  customMin?: number,
  customMax?: number,
): { min: number; max: number } {
  if (r === "Safe") return { min: 3, max: 8 };
  if (r === "Opportunistic") return { min: 12, max: 60 };
  if (r === "Custom") {
    const minRaw = Number.isFinite(customMin) ? (customMin as number) : CUSTOM_DEFAULT_MIN;
    const maxRaw = Number.isFinite(customMax) ? (customMax as number) : CUSTOM_DEFAULT_MAX;
    const min = Math.max(0, Math.min(minRaw, maxRaw));
    const max = Math.max(min + 0.1, Math.max(minRaw, maxRaw));
    return { min, max };
  }
  return { min: 6, max: 18 };
}

function riskBandLabel(r: RiskBand): string {
  return r;
}

const STAGE_LABELS: Record<string, string> = {
  starting: "Preparing",
  preparing: "Preparing",
  loading_pools: "Reading markets",
  reading_markets: "Reading markets",
  scoring: "Reviewing markets",
  selecting_markets: "Selecting markets",
  reviewing_markets: "Reviewing markets",
  generating: "Creating proposal",
  creating_proposal: "Creating proposal",
  reviewing: "Checking proposal",
  checking_proposal: "Checking proposal",
  revising: "Finalizing proposal",
  finalizing_proposal: "Finalizing proposal",
  finalizing: "Finalizing",
  done: "Complete",
  complete: "Complete",
};

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, " ");
}

function progressCopy(message: string): string {
  return message
    .replace(/strategy pipeline/gi, "allocation workflow")
    .replace(/strategy generation/gi, "allocation proposal")
    .replace(/strategy/gi, "allocation")
    .replace(/AI|Claude|Codex|Gemini/gi, "review")
    .replace(/pipeline/gi, "workflow")
    .replace(/backend/gi, "system")
    .replace(/audit/gi, "review");
}

export function AIStrategyModal({ open, onClose, initialBudget = 50000, initialRisk = "Balanced" }: Props) {
  const router = useRouter();
  const [budget, setBudget] = useState<number>(initialBudget);
  const [risk, setRisk] = useState<RiskBand>(initialRisk);
  const [stablesOnly, setStablesOnly] = useState(false);
  const [customApyMin, setCustomApyMin] = useState<number>(CUSTOM_DEFAULT_MIN);
  const [customApyMax, setCustomApyMax] = useState<number>(CUSTOM_DEFAULT_MAX);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvestmentStrategy | null>(null);
  const [picks, setPicks] = useState<AllocationPick[]>([]);
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const draft = loadDraft();
    if (draft) {
      setBudget(draft.budget);
      setRisk(normalizeRiskBand(draft.risk));
      setStablesOnly(draft.stablesOnly);
      setCustomApyMin(
        Number.isFinite(draft.customApyMin) ? draft.customApyMin : CUSTOM_DEFAULT_MIN,
      );
      setCustomApyMax(
        Number.isFinite(draft.customApyMax) ? draft.customApyMax : CUSTOM_DEFAULT_MAX,
      );
      setResult(draft.result);
      setPicks(
        draft.picks?.length === draft.result.allocations.length
          ? draft.picks
          : makeDefaultPicks(draft.result),
      );
    } else {
      setBudget(initialBudget);
      setRisk(initialRisk);
      setCustomApyMin(CUSTOM_DEFAULT_MIN);
      setCustomApyMax(CUSTOM_DEFAULT_MAX);
      setResult(null);
      setPicks([]);
    }
    setError(null);
    setProgress(INITIAL_PROGRESS);
  }, [open, initialBudget, initialRisk]);

  useEffect(() => {
    if (!result) return;
    saveDraft({ budget, risk, stablesOnly, customApyMin, customApyMax, result, picks });
  }, [budget, risk, stablesOnly, customApyMin, customApyMax, result, picks]);

  useEffect(() => {
    if (result && picks.length === 0) {
      setPicks(makeDefaultPicks(result));
    }
  }, [result, picks.length]);

  useEffect(() => {
    if (!open) {
      cancelRef.current = true;
    }
    return () => {
      cancelRef.current = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function runStrategy() {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(INITIAL_PROGRESS);
    cancelRef.current = false;

    const range = apyRange(risk, customApyMin, customApyMax);
    const body: StrategyCriteria = {
      budget,
      riskAppetite: riskToApi(risk, customApyMin, customApyMax),
      targetApyMin: range.min,
      targetApyMax: range.max,
      assetType: stablesOnly ? "stablecoins" : "all",
    };
    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const start = await res.json();
      if (!res.ok || !start?.jobId) {
        throw new Error(progressCopy(start?.error ?? "Failed to start allocation workflow"));
      }
      const jobId: string = start.jobId;

      // Poll the background job until it resolves and mirror its public status.
      while (!cancelRef.current) {
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelRef.current) return;
        const pollRes = await fetch(`/api/strategy?id=${encodeURIComponent(jobId)}`);
        const job = await pollRes.json();
        if (!pollRes.ok) {
          throw new Error(progressCopy(job?.error || "Lost track of allocation workflow"));
        }

        setProgress({
          percent: typeof job.progress === "number" ? job.progress : 0,
          stage: typeof job.stage === "string" ? job.stage : "running",
          message: typeof job.message === "string" ? job.message : "Working…",
          sub: job.sub,
          elapsedMs: typeof job.elapsedMs === "number" ? job.elapsedMs : 0,
          events: Array.isArray(job.events) ? (job.events as ProgressEvent[]) : [],
        });

        if (job.status === "done" && job.result?.strategy) {
          setProgress((p) => ({ ...p, percent: 100 }));
          setResult(job.result.strategy as InvestmentStrategy);
          return;
        }
        if (job.status === "error") {
          throw new Error(progressCopy(job.error || "Allocation workflow failed"));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? progressCopy(e.message) : "Allocation request failed");
    } finally {
      setLoading(false);
    }
  }

  function formatElapsed(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return "0s";
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "color-mix(in oklch, var(--bg-sunken) 68%, transparent)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Allocation desk"
        style={{
          width: "min(720px, 100%)",
          maxHeight: "88vh",
          overflow: "auto",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          boxShadow: "var(--shadow-lg)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--accent-soft)",
              color: "var(--accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icons.zap size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>
              Allocation Desk
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              Build a proposed allocation from your budget, risk range, and market constraints.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="m-icon-btn"
          >
            <Icons.close size={16} />
          </button>
        </header>

        {!result && !loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
            <div>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>
                BUDGET (USD)
              </div>
              <div style={{ position: "relative" }}>
                <span
                  className="mono"
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-dim)",
                    fontSize: 13,
                  }}
                >
                  $
                </span>
                <input
                  className="input mono"
                  type="number"
                  min={100}
                  step={100}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value || 0))}
                  style={{ paddingLeft: 22, width: "100%" }}
                />
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>
                RISK BAND
              </div>
              <div
                style={{
                  display: "flex",
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: 2,
                }}
              >
                {(["Safe", "Balanced", "Opportunistic", "Custom"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRisk(r)}
                    style={{
                      flex: 1,
                      padding: "7px 6px",
                      fontSize: 12,
                      fontWeight: 500,
                      borderRadius: 6,
                      cursor: "pointer",
                      background: risk === r ? "var(--surface)" : "transparent",
                      color: risk === r ? "var(--text)" : "var(--text-dim)",
                      boxShadow: risk === r ? "var(--shadow-xs)" : "none",
                      border: 0,
                      fontFamily: "inherit",
                    }}
                  >
                    {riskBandLabel(r)}
                  </button>
                ))}
              </div>
              {risk === "Custom" ? (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.08em" }}
                    >
                      MIN
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      step={0.5}
                      value={customApyMin}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) setCustomApyMin(Math.max(0, v));
                      }}
                      className="input mono"
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12 }}
                      aria-label="Custom min APY %"
                    />
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>%</span>
                  </div>
                  <span style={{ color: "var(--text-dim)", fontSize: 11 }}>to</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.08em" }}
                    >
                      MAX
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      step={0.5}
                      value={customApyMax}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) setCustomApyMax(Math.max(0, v));
                      }}
                      className="input mono"
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12 }}
                      aria-label="Custom max APY %"
                    />
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>%</span>
                  </div>
                </div>
              ) : null}
              {risk === "Custom" && customApyMax <= customApyMin ? (
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--warn)" }}>
                  Max APY must be greater than min APY.
                </div>
              ) : null}
            </div>
            <label
              style={{
                gridColumn: "1 / span 2",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12.5,
                color: "var(--text-2)",
              }}
            >
              <input
                type="checkbox"
                checked={stablesOnly}
                onChange={(e) => setStablesOnly(e.target.checked)}
              />
              Restrict to stablecoin pools only
            </label>
            <div
              style={{
                gridColumn: "1 / span 2",
                fontSize: 11.5,
                color: "var(--text-dim)",
                lineHeight: 1.5,
              }}
            >
              Uses current market data and risk context to prepare a proposal for review.
              No custody, no approvals, no execution.
            </div>
          </div>
        ) : result ? (
          <StrategyResultView
            result={result}
            criteria={{
              budget,
              riskAppetite: riskToApi(risk, customApyMin, customApyMax),
              targetApyMin: apyRange(risk, customApyMin, customApyMax).min,
              targetApyMax: apyRange(risk, customApyMin, customApyMax).max,
              assetType: stablesOnly ? "stablecoins" : "all",
            }}
            budget={budget}
            picks={picks}
            onPicksChange={setPicks}
            onStartOver={() => {
              clearDraft();
              setResult(null);
              setPicks([]);
              setError(null);
              setProgress(INITIAL_PROGRESS);
            }}
            onActivated={() => {
              clearDraft();
              // Brief delay so the user sees the "MONITORING ACTIVE" success
              // state before the modal closes and we navigate them to the
              // strategies page where the new row is now visible.
              setTimeout(() => {
                onClose();
                router.push("/strategies");
              }, 700);
            }}
          />
        ) : null}

        {loading && !result ? (
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--surface-2)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
            aria-live="polite"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                }}
              >
                {stageLabel(progress.stage)} · {formatElapsed(progress.elapsedMs)}
              </div>
              <div
                className="mono tabular"
                style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}
              >
                {Math.floor(progress.percent)}%
              </div>
            </div>
            <div
              style={{
                height: 4,
                background: "var(--surface-3)",
                borderRadius: 999,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${Math.max(2, progress.percent)}%`,
                  background: "var(--accent)",
                  transition: "width 0.4s ease-out",
                }}
              />
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.5 }}>
              {progressCopy(progress.message)}
              {progress.sub && progress.sub.total > 0
                ? ` (${progress.sub.done}/${progress.sub.total})`
                : ""}
            </div>
            <div
              className="mono"
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "var(--text-dim)",
                lineHeight: 1.7,
                maxHeight: 140,
                overflowY: "auto",
                borderTop: "1px solid var(--line)",
                paddingTop: 10,
              }}
            >
              {progress.events.length === 0 ? (
                <div style={{ opacity: 0.6 }}>
                  <span style={{ color: "var(--accent)" }}>▸</span> Preparing first status update...
                </div>
              ) : (
                progress.events
                  .slice()
                  .reverse()
                  .map((e, i) => {
                    const sub =
                      e.sub && e.sub.total > 0 ? ` (${e.sub.done}/${e.sub.total})` : "";
                    return (
                      <div
                        key={`${e.ts}-${i}`}
                        style={{
                          opacity: i === 0 ? 1 : Math.max(0.4, 1 - i * 0.12),
                        }}
                      >
                        <span style={{ color: "var(--accent)" }}>▸</span>{" "}
                        <span style={{ color: "var(--text-2)" }}>[{stageLabel(e.stage)}]</span>{" "}
                        {progressCopy(e.message)}
                        {sub}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid color-mix(in oklch, var(--danger) 45%, var(--line))",
              background: "color-mix(in oklch, var(--danger) 10%, transparent)",
              color: "var(--danger)",
              fontSize: 12.5,
            }}
          >
            {error}
          </div>
        ) : null}

        <footer
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid var(--line)",
            paddingTop: 14,
          }}
        >
          <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
            {result ? `Prepared ${new Date(result.generatedAt).toLocaleTimeString()}` : "Ready when you are."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {result ? (
              <>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setResult(null);
                    setError(null);
                  }}
                >
                  New allocation
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
                  Done
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-sm" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={
                    loading ||
                    budget < 100 ||
                    (risk === "Custom" && customApyMax <= customApyMin)
                  }
                  onClick={runStrategy}
                >
                  {loading
                    ? `${Math.floor(progress.percent)}% · ${stageLabel(progress.stage)}`
                    : "Create allocation"}{" "}
                  {!loading ? <Icons.arrow size={13} /> : null}
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function StrategyResultView({
  result,
  criteria,
  budget,
  picks,
  onPicksChange,
  onStartOver,
  onActivated,
}: {
  result: InvestmentStrategy;
  criteria: StrategyCriteria;
  budget: number;
  picks: AllocationPick[];
  onPicksChange: (next: AllocationPick[]) => void;
  onStartOver: () => void;
  onActivated: () => void;
}) {
  const { activateStrategy } = useActiveStrategies();
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [leverageMode, setLeverageMode] = useState(false);

  const safePicks = picks.length === result.allocations.length ? picks : makeDefaultPicks(result);
  const totalPercent = totalIncludedPercent(safePicks);
  const includedCount = safePicks.filter((p) => p.included).length;
  const customized = customizeStrategy(result, safePicks, budget);

  // In normal mode, allocations must sum to ~100%. In leverage mode any
  // positive sum is valid — values >100% mean recursive/leveraged exposure
  // (loop-borrow, leveraged LP), values <100% mean some capital is parked.
  const sumOk = leverageMode ? totalPercent > 0 : Math.abs(totalPercent - 100) < 0.5;
  const hasPicks = includedCount > 0;
  const isCustomized = customized.removedPoolIds.length > 0 || customized.changedPoolIds.length > 0;
  const leverageRatio = totalPercent / 100;
  const totalDeployed = Math.round((budget * totalPercent) / 100);

  function updatePick(poolId: string, patch: Partial<AllocationPick>) {
    onPicksChange(
      safePicks.map((p) => (p.poolId === poolId ? { ...p, ...patch } : p)),
    );
  }

  function handleNormalize() {
    onPicksChange(normalizePicks(safePicks));
  }

  function handleResetPicks() {
    onPicksChange(makeDefaultPicks(result));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ fontSize: 10 }}>
            PROJECTED APY
            {isCustomized ? (
              <span style={{ marginLeft: 8, color: "var(--accent)", fontSize: 9 }}>(YOUR EDIT)</span>
            ) : null}
          </div>
          <div
            className="num display"
            style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}
          >
            {customized.strategy.projectedApy.toFixed(2)}%
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>
            {isCustomized
              ? `your picks · ${includedCount} of ${result.allocations.length} pools`
              : `blended across ${result.allocations.length} pools`}
          </div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ fontSize: 10 }}>
            PROJECTED ANNUAL YIELD
          </div>
          <div
            className="num display"
            style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}
          >
            ${customized.strategy.projectedYearlyReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>
            {leverageMode && Math.abs(leverageRatio - 1) > 0.01
              ? `${leverageRatio.toFixed(2)}× exposure · pre-borrow-cost`
              : "at current rates — not guaranteed"}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.55 }}>
        {result.summary}
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600 }}>Allocation mix</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10.5,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: leverageMode ? "var(--accent)" : "var(--text-dim)",
                cursor: "pointer",
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                padding: "4px 8px",
                border: `1px solid ${leverageMode ? "color-mix(in oklch, var(--accent) 38%, transparent)" : "var(--line)"}`,
                background: leverageMode ? "var(--accent-soft)" : "transparent",
                borderRadius: 6,
                userSelect: "none",
              }}
              title="Allow allocations >100% (leveraged / recursive positions). Borrow rates and liquidation risk are not modeled."
            >
              <input
                type="checkbox"
                checked={leverageMode}
                onChange={(e) => setLeverageMode(e.target.checked)}
                style={{ cursor: "pointer", accentColor: "var(--accent)" }}
              />
              Leverage
            </label>
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: sumOk ? "var(--good)" : "var(--warn)",
                letterSpacing: "0.04em",
              }}
              title={
                leverageMode
                  ? `Total exposure: ${leverageRatio.toFixed(2)}× of $${budget.toLocaleString()} = $${totalDeployed.toLocaleString()}`
                  : "Sum of percents across included pools. Must equal 100% to activate."
              }
            >
              {leverageMode
                ? `${leverageRatio.toFixed(2)}× · $${totalDeployed.toLocaleString()} deployed`
                : `${totalPercent.toFixed(1)}% / 100%`}
            </span>
            <button
              type="button"
              onClick={handleNormalize}
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                background: "transparent",
                border: "1px solid var(--line)",
                color: "var(--text-dim)",
                padding: "4px 8px",
                cursor: "pointer",
                borderRadius: 6,
              }}
              title="Scale included percents proportionally so they sum to exactly 100%"
            >
              Normalize
            </button>
            <button
              type="button"
              onClick={handleResetPicks}
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                background: "transparent",
                border: "1px solid var(--line)",
                color: "var(--text-dim)",
                padding: "4px 8px",
                cursor: "pointer",
                borderRadius: 6,
              }}
              title="Restore the original allocation"
            >
              Reset
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {result.allocations.map((a, i) => {
            const pick = safePicks.find((p) => p.poolId === a.poolId) ?? {
              poolId: a.poolId,
              included: true,
              percent: a.allocationPercent,
            };
            const liveAmount = pick.included ? Math.round((budget * pick.percent) / 100) : 0;
            const dimmed = !pick.included;
            return (
            <div
              key={`${a.protocol}-${a.poolId}-${i}`}
              className="card"
              style={{ padding: 12, opacity: dimmed ? 0.55 : 1 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={pick.included}
                    onChange={(e) => updatePick(a.poolId, { included: e.target.checked })}
                    aria-label={`Include ${a.symbol} on ${a.protocol}`}
                    style={{ marginTop: 3, cursor: "pointer" }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {a.symbol} <span style={{ color: "var(--text-dim)" }}>· {a.protocol}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
                      {a.chain.toUpperCase()} · APY {a.apy.toFixed(2)}% · TVL $
                      {(a.tvl / 1_000_000).toFixed(1)}M
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      min={0}
                      max={leverageMode ? 500 : 100}
                      step={0.1}
                      value={pick.percent}
                      disabled={!pick.included}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        const cap = leverageMode ? 500 : 100;
                        if (Number.isFinite(v)) updatePick(a.poolId, { percent: Math.max(0, Math.min(cap, v)) });
                      }}
                      className="mono"
                      style={{
                        width: 64,
                        textAlign: "right",
                        background: "var(--surface-2)",
                        border: "1px solid var(--line)",
                        borderRadius: 6,
                        padding: "4px 6px",
                        fontSize: 12,
                        color: pick.included ? "var(--accent)" : "var(--text-muted)",
                      }}
                    />
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>%</span>
                  </div>
                  <div className="num" style={{ fontSize: 12, fontWeight: 500, color: pick.included ? "var(--text-1)" : "var(--text-muted)" }}>
                    ${liveAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
              {a.reasoning ? (
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6, lineHeight: 1.5 }}>
                  {a.reasoning}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <a
                  href={getDepositUrl(a.protocol, a.poolId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="m-icon-btn"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    width: "auto",
                    height: "auto",
                  }}
                >
                  Deposit on {a.protocol}
                  <Icons.external size={12} />
                </a>
                <a
                  href={`https://defillama.com/yields/pool/${a.poolId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="m-icon-btn"
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    color: "var(--text-2)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    width: "auto",
                    height: "auto",
                  }}
                >
                  Pool details
                  <Icons.external size={12} />
                </a>
                {a.contractAddress ? (
                  <Link
                    href={`/security/audit?address=${a.contractAddress}&chain=${encodeURIComponent(a.auditChain ?? a.chain)}&autostart=1`}
                    className="m-icon-btn"
                    title="Open a contract risk review for this market"
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      color: "var(--text-2)",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      width: "auto",
                      height: "auto",
                    }}
                  >
                    Security review
                    <Icons.arrow />
                  </Link>
                ) : null}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {result.warnings?.length ? (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid color-mix(in oklch, var(--warn) 45%, var(--line))",
            background: "color-mix(in oklch, var(--warn) 10%, transparent)",
            fontSize: 12,
            color: "var(--text-1)",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            NOTICE
          </div>
          {result.warnings.map((w, i) => (
            <div key={i}>· {w}</div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          padding: 14,
          borderRadius: 12,
          border: "1px solid color-mix(in oklch, var(--accent) 35%, var(--line))",
          background: "var(--accent-soft)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            MONITORING
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.55 }}>
            Activate read-only monitoring for the selected allocation. Sovereign tracks material changes to the listed markets and records alerts for review. <strong>This does not record a deposit or move funds.</strong>
          </div>
        </div>
        {activateError ? (
          <div style={{ fontSize: 11.5, color: "var(--danger)" }}>
            {activateError}
          </div>
        ) : null}
        {!hasPicks ? (
          <div style={{ fontSize: 11.5, color: "var(--warn)" }}>
            Select at least one pool to activate.
          </div>
        ) : leverageMode && leverageRatio > 1 ? (
          <div style={{ fontSize: 11.5, color: "var(--warn)" }}>
            Leveraged exposure ({leverageRatio.toFixed(2)}×) — borrow rates, liquidation thresholds, and unwind costs are not modeled. You are responsible for managing the loop.
          </div>
        ) : leverageMode && leverageRatio < 1 ? (
          <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
            {((1 - leverageRatio) * 100).toFixed(1)}% of capital is uninvested — only ${totalDeployed.toLocaleString()} of ${budget.toLocaleString()} will be deployed.
          </div>
        ) : !sumOk ? (
          <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
            Allocations sum to {totalPercent.toFixed(1)}% — we&apos;ll auto-normalize to 100% on activation.
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={activating || activated || !hasPicks}
            onClick={async () => {
              setActivateError(null);
              setActivating(true);
              try {
                // In normal mode, auto-normalize picks that don't sum to ~100%.
                // In leverage mode, accept the user's chosen exposure as-is —
                // they explicitly opted into >100% or under-deployment.
                let picksForActivation = safePicks;
                if (!leverageMode && !sumOk) {
                  picksForActivation = normalizePicks(safePicks);
                  onPicksChange(picksForActivation);
                }
                const finalCustomized = customizeStrategy(result, picksForActivation, budget);
                await activateStrategy(finalCustomized.strategy, criteria);
                setActivated(true);
                onActivated();
              } catch (err) {
                setActivateError(err instanceof Error ? err.message : "Failed to activate");
              } finally {
                setActivating(false);
              }
            }}
          >
            {activated
              ? "MONITORING ACTIVE"
              : activating
                ? "ACTIVATING…"
                : isCustomized
                  ? "MONITOR MY ALLOCATION"
                  : "MONITOR ALLOCATION"}{" "}
            {!activated && !activating ? <Icons.arrow size={13} /> : null}
          </button>
          <button
            type="button"
            onClick={onStartOver}
            disabled={activating}
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--text-dim)",
              padding: "8px 14px",
              cursor: activating ? "not-allowed" : "pointer",
              borderRadius: 8,
            }}
            title="Discard this allocation and start a new one"
          >
            Start over
          </button>
        </div>
        {activated ? (
          <Link
            href="/strategies"
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--accent)",
              textDecoration: "none",
              alignSelf: "flex-start",
            }}
          >
            View active allocations →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default AIStrategyModal;
