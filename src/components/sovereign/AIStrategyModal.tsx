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

type RiskBand = "Safe" | "Balanced" | "Degen" | "Custom";

interface PersistedDraft {
  budget: number;
  risk: RiskBand;
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
  message: "Initializing strategy pipeline…",
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
  if (r === "Degen") return "high";
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
  if (r === "Degen") return { min: 12, max: 60 };
  if (r === "Custom") {
    const minRaw = Number.isFinite(customMin) ? (customMin as number) : CUSTOM_DEFAULT_MIN;
    const maxRaw = Number.isFinite(customMax) ? (customMax as number) : CUSTOM_DEFAULT_MAX;
    const min = Math.max(0, Math.min(minRaw, maxRaw));
    const max = Math.max(min + 0.1, Math.max(minRaw, maxRaw));
    return { min, max };
  }
  return { min: 6, max: 18 };
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
      setRisk(draft.risk);
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
        throw new Error(start?.error ?? "Failed to start strategy job");
      }
      const jobId: string = start.jobId;

      // Poll backend job until it resolves. Backend keeps the job in-memory
      // and we just mirror its current stage/message into the UI state.
      while (!cancelRef.current) {
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelRef.current) return;
        const pollRes = await fetch(`/api/strategy?id=${encodeURIComponent(jobId)}`);
        const job = await pollRes.json();
        if (!pollRes.ok) {
          throw new Error(job?.error || "Lost track of strategy job");
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
          throw new Error(job.error || "Strategy generation failed");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Strategy request failed");
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
        aria-label="AI Strategy"
        style={{
          width: "min(720px, 100%)",
          maxHeight: "88vh",
          overflow: "auto",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 20,
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
              The Strategist
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              A portfolio, written for you — proposed, defended, and revised before it reaches you.
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
                {(["Safe", "Balanced", "Degen", "Custom"] as const).map((r) => (
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
                    {r}
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
              Uses live yield telemetry, contract security checks, and a protocol
              risk scorer. No fabricated pools, no placeholder APYs.
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
                {progress.stage.replace(/_/g, " ")} · {formatElapsed(progress.elapsedMs)}
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
              {progress.message}
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
                  <span style={{ color: "var(--accent)" }}>▸</span> Waiting for first backend event…
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
                        <span style={{ color: "var(--text-2)" }}>[{e.stage}]</span>{" "}
                        {e.message}
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
            {result ? `Generated ${new Date(result.generatedAt).toLocaleTimeString()}` : "Ready when you are."}
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
                  New scan
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
                    ? `${Math.floor(progress.percent)}% · ${progress.stage.replace(/_/g, " ")}`
                    : "Generate strategy"}{" "}
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
      <CollaborationBadge result={result} />

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

      <CollaborationDetails result={result} />


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
          <div style={{ fontSize: 13, fontWeight: 600 }}>Allocations · pick & weight</div>
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
              title="Restore the AI's original allocation"
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
                    title="Run multi-engine smart-contract audit (static, AST, symbolic, and on-chain interrogation reconciled by a triple-AI panel)"
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
                    Deep audit
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
            HEADS UP
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
            CONTINUOUS MONITORING
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.55 }}>
            Activate to have us watch every protocol in this strategy 24/7 — APY drops, TVL drains, on-chain pauses, and known exploit alerts. We notify you the moment something changes. <strong>This does not record a deposit.</strong>
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
                  ? "USE MY PICKS · MONITOR"
                  : "USE STRATEGY · MONITOR"}{" "}
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
            title="Discard this strategy and start a new one"
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
            View active strategies →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function CollaborationBadge({ result }: { result: InvestmentStrategy }) {
  const c = result.collaboration;
  if (!c) return null;
  const total = c.critiquePoints.length;
  // Older cached strategies may not have `verifiable` set — fall back to the
  // legacy "everything is verifiable" assumption so they still render.
  const hasVerifiableField = c.critiquePoints.some((p) => p.verifiable !== undefined);
  const verifiable = hasVerifiableField
    ? c.critiquePoints.filter((p) => p.verifiable)
    : c.critiquePoints;
  const advisory = hasVerifiableField
    ? c.critiquePoints.filter((p) => !p.verifiable)
    : [];
  const verifiableTotal = verifiable.length;
  const verifiableAddressed = verifiable.filter((p) => p.addressed).length;
  const advisoryRejected = advisory.filter((p) => p.claudeRejection).length;
  const verdicts = c.reviewerVerdicts ?? { codex: c.codexVerdict, gemini: "unavailable" as const };
  const codexAvailable = verdicts.codex !== "unavailable";
  const geminiAvailable = verdicts.gemini !== "unavailable";
  const availableCount = (codexAvailable ? 1 : 0) + (geminiAvailable ? 1 : 0);
  const allApproved =
    codexAvailable && geminiAvailable &&
    verdicts.codex === "approve" &&
    verdicts.gemini === "approve" &&
    total === 0;

  const buildHeadline = () => {
    if (verifiableTotal === 0 && advisory.length === 0) return "no concerns raised";
    const parts: string[] = [];
    if (verifiableTotal > 0) parts.push(`${verifiableAddressed}/${verifiableTotal} verifiable concerns addressed`);
    if (advisory.length > 0) {
      const advisoryNote =
        advisoryRejected > 0
          ? `${advisory.length} advisory note${advisory.length === 1 ? "" : "s"} (${advisoryRejected} explicitly rejected)`
          : `${advisory.length} advisory note${advisory.length === 1 ? "" : "s"}`;
      parts.push(advisoryNote);
    }
    return parts.join(" · ");
  };

  let label: string;
  let tone: "good" | "warn" | "info";
  if (availableCount === 0) {
    label = "Single-AI fallback (both reviewers unavailable)";
    tone = "warn";
  } else if (availableCount === 1) {
    const who = codexAvailable ? "Reviewer A" : "Reviewer B";
    label = `Partial review — only ${who} was available · ${buildHeadline()}`;
    tone = "warn";
  } else if (allApproved) {
    label = "Approved by both reviewers (no concerns)";
    tone = "good";
  } else {
    label = buildHeadline();
    tone = verifiableTotal > 0 && verifiableAddressed === verifiableTotal ? "good" : "info";
  }

  const toneColor =
    tone === "good"
      ? "var(--good)"
      : tone === "warn"
        ? "var(--warn)"
        : "var(--accent)";

  const verdictChip = (name: string, verdict: string) => {
    const color =
      verdict === "approve"
        ? "var(--good)"
        : verdict === "revise"
          ? "var(--warn)"
          : verdict === "reject"
            ? "var(--danger)"
            : "var(--text-dim)";
    return (
      <span
        key={name}
        className="mono"
        style={{
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: 999,
          border: `1px solid color-mix(in oklch, ${color} 45%, var(--line))`,
          background: `color-mix(in oklch, ${color} 10%, transparent)`,
          color,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {name}: {verdict}
      </span>
    );
  };

  return (
    <div
      className="card"
      style={{
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderColor: `color-mix(in oklch, ${toneColor} 35%, var(--line))`,
        background: `color-mix(in oklch, ${toneColor} 6%, var(--surface))`,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: `color-mix(in oklch, ${toneColor} 18%, transparent)`,
          color: toneColor,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icons.shield size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="eyebrow" style={{ fontSize: 10, color: toneColor, marginBottom: 2 }}>
          TRIPLE-AI COLLABORATION
        </div>
        <div
          style={{ fontSize: 12.5, color: "var(--text-1)", cursor: "help" }}
          title="Verifiable concerns cite a specific poolId or relate to budget summing — the resolver checks whether the lead architect dropped the pool, cut its allocation by ≥20%, or rewrote the reasoning. Advisory notes are abstract or stylistic and can't be deterministically verified; for high-severity ones the architect must provide a rejection rationale. Expand 'Reviewer concerns' below to see each one's outcome."
        >
          {label}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {verdictChip("Reviewer A", verdicts.codex)}
          {verdictChip("Reviewer B", verdicts.gemini)}
        </div>
      </div>
      {availableCount > 0 && c.initialProjectedApy !== c.finalProjectedApy ? (
        <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right" }}>
          APY {c.initialProjectedApy.toFixed(2)}% → {c.finalProjectedApy.toFixed(2)}%
        </div>
      ) : null}
    </div>
  );
}

function CollaborationDetails({ result }: { result: InvestmentStrategy }) {
  const c = result.collaboration;
  if (!c || c.critiquePoints.length === 0) return null;

  return (
    <details
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "10px 12px",
        background: "var(--surface-2)",
      }}
    >
      <summary
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          cursor: "pointer",
          color: "var(--text-1)",
          listStyle: "none",
        }}
      >
        Reviewer concerns &amp; how they were resolved ({c.critiquePoints.length})
      </summary>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {c.revisionNotes ? (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-2)",
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            {c.revisionNotes}
          </div>
        ) : null}
        {c.critiquePoints.map((p, i) => {
          const sevColor =
            p.severity === "high"
              ? "var(--danger)"
              : p.severity === "medium"
                ? "var(--warn)"
                : "var(--text-dim)";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 8,
                fontSize: 12,
                lineHeight: 1.5,
                paddingTop: 8,
                borderTop: i === 0 ? "none" : "1px dashed var(--line)",
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: p.addressed
                    ? "var(--good)"
                    : p.claudeRejection
                      ? "var(--warn)"
                      : sevColor,
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "var(--text-1)" }}>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: sevColor,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginRight: 6,
                    }}
                  >
                    {p.severity} · {p.category.replace("_", " ")}
                  </span>
                  {p.sources && p.sources.length > 0 ? (
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: p.sources.length > 1 ? "var(--accent)" : "var(--text-dim)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        marginRight: 6,
                      }}
                    >
                      · {p.sources.length > 1 ? "both reviewers" : p.sources[0] === "codex" ? "reviewer A" : "reviewer B"}
                    </span>
                  ) : null}
                  {p.issue}
                </div>
                {p.suggestion ? (
                  <div style={{ color: "var(--text-dim)", marginTop: 2 }}>
                    Fix suggested: {p.suggestion}
                  </div>
                ) : null}
                {(() => {
                  const isVerifiable = p.verifiable !== false; // legacy strategies: assume verifiable
                  let outcomeLabel: string;
                  let outcomeColor: string;
                  if (p.addressed) {
                    outcomeLabel = "✓ ADDRESSED IN REVISION";
                    outcomeColor = "var(--good)";
                  } else if (p.claudeRejection) {
                    outcomeLabel = "● EXPLICITLY REJECTED BY ARCHITECT";
                    outcomeColor = "var(--warn)";
                  } else if (!isVerifiable) {
                    outcomeLabel = "◌ ADVISORY — NOT DETERMINISTICALLY VERIFIABLE";
                    outcomeColor = "var(--text-dim)";
                  } else {
                    outcomeLabel = "○ NOT ADDRESSED — NO RATIONALE GIVEN";
                    outcomeColor = "var(--danger)";
                  }
                  return (
                    <>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: outcomeColor,
                          marginTop: 3,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {outcomeLabel}
                      </div>
                      {p.claudeRejection ? (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--text-2)",
                            marginTop: 3,
                            paddingLeft: 8,
                            borderLeft: "2px solid var(--warn)",
                          }}
                        >
                          Architect rationale: {p.claudeRejection}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

export default AIStrategyModal;
