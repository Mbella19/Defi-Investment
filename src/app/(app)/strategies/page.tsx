"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BellRing,
  CirclePause,
  Play,
  RefreshCw,
  Trash2,
  WandSparkles,
} from "lucide-react";
import {
  ChainBadge,
  CommandStrip,
  EmptyState,
  MetricTile,
  RiskPill,
} from "@/components/site/ui";
import { PoolIcon } from "@/components/site/PoolIcon";
import {
  chainIdFromName,
  formatMoney,
  formatPct,
  type RiskBand,
} from "@/lib/design-utils";
import Link from "next/link";
import { useActiveStrategies } from "@/hooks/useActiveStrategies";
import { useSiweAuth } from "@/hooks/useSiweAuth";
import { usePlan } from "@/hooks/usePlan";
import type { InvestmentStrategy, StrategyAllocation, StrategyCriteria } from "@/types/strategy";
import type { ActiveStrategy, StrategyStatus } from "@/types/active-strategy";

type RiskAppetite = "low" | "medium" | "high";

interface JobView {
  jobId?: string;
  status: "idle" | "running" | "done" | "error";
  progress: number;
  stage?: string;
  message?: string;
  events?: Array<{ ts: number; stage: string; message: string }>;
  result?: {
    strategy: InvestmentStrategy;
    poolsScanned: number;
    protocolsAnalyzed: number;
    protocolsDeepAnalyzed: number;
  };
  error?: string;
}

const RISK_TO_APPETITE: Record<RiskBand, RiskAppetite> = {
  Conservative: "low",
  Balanced: "medium",
  Asymmetric: "high",
};

const APY_RANGE: Record<RiskBand, [number, number]> = {
  Conservative: [3, 10],
  Balanced: [6, 18],
  Asymmetric: [12, 40],
};

const STATUS_TONE: Record<StrategyStatus, "ok" | "warn" | "info"> = {
  active: "ok",
  paused: "warn",
  archived: "info",
};

function describeStage(stage?: string): string {
  if (!stage) return "ready";
  return stage.replace(/_/g, " ");
}

export default function StrategiesPage() {
  const { status: authStatus, signIn } = useSiweAuth();
  const isAuthed = authStatus === "authed";
  const plan = usePlan();
  const {
    strategies,
    isLoading,
    error: listError,
    refetch,
    updateStatus,
    deleteStrategy,
    runScan,
    activateStrategy,
  } = useActiveStrategies();

  const [budget, setBudget] = useState(125_000);
  const [risk, setRisk] = useState<RiskBand>("Balanced");
  const [stableOnly, setStableOnly] = useState(true);
  // Custom-APY mode (Ultra-only). When enabled, the user supplies their own APY range.
  const [customApyEnabled, setCustomApyEnabled] = useState(false);
  const [customApyMin, setCustomApyMin] = useState(8);
  const [customApyMax, setCustomApyMax] = useState(20);
  const [job, setJob] = useState<JobView>({ status: "idle", progress: 0 });
  const [activateBusy, setActivateBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanSummary, setScanSummary] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const activeCount = strategies.filter((s) => s.status === "active").length;
  const totalCapital = strategies
    .filter((s) => s.status !== "archived")
    .reduce((sum, s) => sum + s.totalBudget, 0);
  const openAlerts = strategies.reduce((sum, s) => sum + (s.alertCount ?? 0), 0);

  const draftStrategy = job.result?.strategy ?? null;
  const draftApy = draftStrategy?.projectedApy ?? 0;

  async function generate() {
    // If wagmi connected but SIWE session is missing, transparently sign first
    // so the user doesn't have to click a separate sign-in button before the
    // actual action. The wallet is already shown in the topbar — they think
    // they're signed in.
    if (!isAuthed) {
      try {
        await signIn();
      } catch {
        setJob({
          status: "error",
          progress: 0,
          error: "Wallet authorization was cancelled — accept the signature request to generate a strategy.",
        });
        return;
      }
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setJob({ status: "running", progress: 0, message: "Preparing allocation workflow…" });
    const usingCustomApy = plan.capabilities.customApyMode && customApyEnabled;
    const [presetMin, presetMax] = APY_RANGE[risk];
    const targetApyMin = usingCustomApy ? Math.max(0.5, customApyMin) : presetMin;
    const targetApyMax = usingCustomApy ? Math.max(targetApyMin + 0.5, customApyMax) : presetMax;
    const effectiveRisk: RiskBand = plan.capabilities.riskBandSelection ? risk : "Balanced";
    const effectiveStable = plan.capabilities.stablecoinToggle ? stableOnly : false;
    const criteria: StrategyCriteria = {
      budget,
      riskAppetite: RISK_TO_APPETITE[effectiveRisk],
      targetApyMin,
      targetApyMax,
      assetType: effectiveStable ? "stablecoins" : "all",
    };
    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Generator failed (${res.status})`);
      }
      const data = (await res.json()) as { jobId: string; status: string; progress: number; message: string };
      setJob({ jobId: data.jobId, status: "running", progress: data.progress, message: data.message });

      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch(`/api/strategy?id=${data.jobId}`);
          if (!s.ok) {
            const detail = await s.json().catch(() => ({}));
            throw new Error((detail as { error?: string }).error ?? `Status ${s.status}`);
          }
          const view = (await s.json()) as JobView & { events?: JobView["events"] };
          setJob({
            jobId: data.jobId,
            status: view.status,
            progress: view.progress,
            stage: view.stage,
            message: view.message,
            events: view.events,
            result: view.result,
            error: view.error,
          });
          if (view.status === "done" || view.status === "error") {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch (err) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setJob({
            status: "error",
            progress: 0,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }, 2_000);
    } catch (err) {
      setJob({
        status: "error",
        progress: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function activate() {
    if (!draftStrategy) return;
    if (!isAuthed) {
      try {
        await signIn();
      } catch {
        return;
      }
    }
    setActivateBusy(true);
    try {
      const usingCustomApy = plan.capabilities.customApyMode && customApyEnabled;
      const [presetMin, presetMax] = APY_RANGE[risk];
      const targetApyMin = usingCustomApy ? Math.max(0.5, customApyMin) : presetMin;
      const targetApyMax = usingCustomApy ? Math.max(targetApyMin + 0.5, customApyMax) : presetMax;
      const effectiveRisk: RiskBand = plan.capabilities.riskBandSelection ? risk : "Balanced";
      const effectiveStable = plan.capabilities.stablecoinToggle ? stableOnly : false;
      const criteria: StrategyCriteria = {
        budget,
        riskAppetite: RISK_TO_APPETITE[effectiveRisk],
        targetApyMin,
        targetApyMax,
        assetType: effectiveStable ? "stablecoins" : "all",
      };
      await activateStrategy(draftStrategy, criteria);
      // Reset the draft slot once it moves into the active list.
      setJob({ status: "idle", progress: 0 });
    } catch {
      /* surfaced through the hook errors */
    } finally {
      setActivateBusy(false);
    }
  }

  async function handleScan(id?: string) {
    if (!isAuthed) {
      await signIn().catch(() => {});
      return;
    }
    setScanBusy(true);
    setScanSummary(null);
    try {
      const result = await runScan(id);
      setScanSummary(
        `Reviewed ${result.scanned} ${result.scanned === 1 ? "allocation" : "allocations"} — ${
          result.newAlerts.length === 0
            ? "no new alerts"
            : `${result.newAlerts.length} new alert${result.newAlerts.length === 1 ? "" : "s"}`
        }`,
      );
    } catch {
      setScanSummary("Refresh failed — try again in a moment.");
    } finally {
      setScanBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Strategies</p>
          <h1>Allocations that hold up to scrutiny.</h1>
          <p>
            Tell us your risk and budget. An independent analyst council builds your
            allocation, an adversarial review challenges every pick, and only the strategy
            that survives both reaches you. Then we watch it for as long as your capital
            sits in it.
          </p>
        </div>
      </div>

      <CommandStrip
        file="file/03.strategies"
        items={[
          { label: "composer", value: job.status === "running" ? "running" : "ready", tone: job.status === "running" ? "warn" : "ok" },
          { label: "analyst panel", value: "online", tone: "info" },
          { label: "safety guardrails", value: "active", tone: "danger" },
        ]}
      />

      {!plan.isLoading && isAuthed ? (
        <div className="plan-strip">
          <span className={`plan-strip-tag tier-${plan.tier}`}>{plan.tier}</span>
          <strong>{plan.usage.strategiesThisMonth}</strong>
          <span>of {plan.capabilities.monthlyStrategies} strategies used this month</span>
          <Link href="/account/alerts" style={{ marginLeft: "auto" }}>Manage alert channels →</Link>
          {plan.tier !== "ultra" ? (
            <Link href="/plans">Upgrade →</Link>
          ) : null}
        </div>
      ) : null}

      <div className="metric-grid" style={{ marginBottom: 18 }}>
        <MetricTile label="Active capital" value={formatMoney(totalCapital)} icon={Activity} tone="#6ee7b7" />
        <MetricTile
          label="Open alerts"
          value={String(openAlerts)}
          icon={BellRing}
          tone={openAlerts > 0 ? "#fb7185" : "#fbbf24"}
        />
        <MetricTile
          label="Draft APY"
          value={draftStrategy ? formatPct(draftApy) : "—"}
          icon={WandSparkles}
          tone="#60a5fa"
        />
        <MetricTile label="Active mandates" value={String(activeCount)} icon={RefreshCw} tone="#fbbf24" />
      </div>

      <div className="strategy-layout">
        <div className="strategy-stack">
          {authStatus === "checking" || isLoading ? (
            <EmptyState icon={RefreshCw} title="Loading mandates" body="Reading wallet-scoped strategies…" />
          ) : !isAuthed ? (
            <EmptyState
              icon={WandSparkles}
              title="Draft your first mandate"
              body="Use the composer on the right — set your budget and risk band, then hit Generate. We'll prompt your wallet for a one-time authorization signature, then build a custom-weighted allocation."
            />
          ) : strategies.length === 0 ? (
            <EmptyState
              icon={WandSparkles}
              title="No allocations under monitoring"
              body="Use the composer on the right to draft a mandate. Once you accept the proposal, it shows up here for monitoring."
            />
          ) : (
            <>
              {listError ? (
                <div className="ticker">
                  <span className="severity-medium">{listError}</span>
                </div>
              ) : null}
              {scanSummary ? (
                <div className="ticker">
                  <span>{scanSummary}</span>
                </div>
              ) : null}
              {strategies.map((strategy) => (
                <StrategyArticle
                  key={strategy.id}
                  strategy={strategy}
                  onScan={() => handleScan(strategy.id)}
                  scanBusy={scanBusy}
                  onPause={() => updateStatus(strategy.id, "paused").catch(() => {})}
                  onResume={() => updateStatus(strategy.id, "active").catch(() => {})}
                  onArchive={() => updateStatus(strategy.id, "archived").catch(() => {})}
                  onDelete={() => {
                    if (confirm("Delete this allocation and all related alerts?")) {
                      deleteStrategy(strategy.id).catch(() => {});
                    }
                  }}
                />
              ))}
              <div className="filter-row" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="ghost-button" onClick={() => refetch()}>
                  <RefreshCw size={16} aria-hidden="true" /> Refresh list
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleScan()}
                  disabled={scanBusy || activeCount === 0}
                >
                  <BellRing size={16} aria-hidden="true" />
                  {scanBusy ? "Reviewing…" : "Run monitor"}
                </button>
              </div>
            </>
          )}
        </div>

        <aside className="boost-panel">
          <p className="eyebrow">Allocation Composer</p>
          <h2 style={{ margin: "0 0 12px", fontSize: 30, lineHeight: 1.06 }}>Draft a new mandate</h2>
          <div className="sim-controls">
            <label>
              Budget (USD)
              <input
                className="number-input"
                type="number"
                min={1000}
                max={10_000_000}
                step={1000}
                value={budget}
                onChange={(event) => setBudget(Math.max(1000, Number(event.target.value) || 0))}
              />
            </label>
            <label>
              Risk band
              {plan.capabilities.riskBandSelection ? null : (
                <small style={{ color: "var(--soft)", display: "block", marginTop: 2, fontSize: 11, fontWeight: 500 }}>
                  Locked on Free — <Link href="/plans" style={{ color: "var(--mint)" }}>upgrade</Link>
                </small>
              )}
              <select
                className="select-input"
                value={risk}
                onChange={(event) => setRisk(event.target.value as RiskBand)}
                disabled={!plan.capabilities.riskBandSelection}
              >
                <option value="Conservative">Conservative</option>
                <option value="Balanced">Balanced</option>
                <option value="Asymmetric">Asymmetric</option>
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={plan.capabilities.stablecoinToggle ? stableOnly : false}
                onChange={(event) => setStableOnly(event.target.checked)}
                disabled={!plan.capabilities.stablecoinToggle}
              />
              Stablecoin sleeves only
              {!plan.capabilities.stablecoinToggle ? (
                <Link href="/plans" style={{ color: "var(--mint)", fontSize: 11, marginLeft: 6 }}>
                  Pro+
                </Link>
              ) : null}
            </label>
            {plan.capabilities.customApyMode ? (
              <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)" }}>
                <input
                  type="checkbox"
                  checked={customApyEnabled}
                  onChange={(event) => setCustomApyEnabled(event.target.checked)}
                />
                Custom APY range (Ultra)
              </label>
            ) : null}
            {plan.capabilities.customApyMode && customApyEnabled ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label>
                  Min APY %
                  <input
                    className="number-input"
                    type="number"
                    min={0.5}
                    max={400}
                    step={0.5}
                    value={customApyMin}
                    onChange={(event) =>
                      setCustomApyMin(Math.max(0.5, Number(event.target.value) || 0.5))
                    }
                  />
                </label>
                <label>
                  Max APY %
                  <input
                    className="number-input"
                    type="number"
                    min={1}
                    max={500}
                    step={0.5}
                    value={customApyMax}
                    onChange={(event) =>
                      setCustomApyMax(Math.max(1, Number(event.target.value) || 1))
                    }
                  />
                </label>
              </div>
            ) : null}
            <button
              className="primary-button"
              type="button"
              onClick={generate}
              disabled={
                job.status === "running" ||
                authStatus === "signing" ||
                authStatus === "checking" ||
                (isAuthed &&
                  !plan.isLoading &&
                  plan.usage.strategiesThisMonth >= plan.capabilities.monthlyStrategies)
              }
            >
              <WandSparkles size={18} aria-hidden="true" />
              {job.status === "running"
                ? "Generating…"
                : authStatus === "checking"
                  ? "Loading session…"
                  : authStatus === "signing"
                    ? "Confirm in wallet…"
                    : isAuthed && plan.usage.strategiesThisMonth >= plan.capabilities.monthlyStrategies
                      ? "Monthly cap reached"
                      : "Generate draft"}
            </button>
            {isAuthed &&
            !plan.isLoading &&
            plan.usage.strategiesThisMonth >= plan.capabilities.monthlyStrategies ? (
              <Link
                href="/plans"
                className="ghost-button"
                style={{ justifyContent: "center" }}
              >
                Upgrade for more strategies
              </Link>
            ) : null}
          </div>

          {job.status !== "idle" ? (
            <div style={{ marginTop: 16 }}>
              <div className="audit-progress" aria-label={`${job.progress}% complete`}>
                <i style={{ width: `${job.progress}%` }} />
              </div>
              <div className="composer-progress">
                <p>
                  <strong>{describeStage(job.stage ?? job.status)}</strong>
                  {job.message ? ` · ${job.message}` : null}
                </p>
                {(job.events ?? []).slice(-6).map((ev, i) => (
                  <p key={`${ev.ts}-${i}`}>· {ev.message}</p>
                ))}
                {job.error ? <p className="severity-high">{job.error}</p> : null}
              </div>
            </div>
          ) : null}

          {draftStrategy ? (
            <div style={{ marginTop: 16 }}>
              <div className="ticker">
                <span>
                  Projected APY <b>{formatPct(draftStrategy.projectedApy)}</b>
                </span>
                <span>
                  Yearly <b>{formatMoney(draftStrategy.projectedYearlyReturn)}</b>
                </span>
              </div>
              <div className="allocation-list" style={{ marginTop: 14 }}>
                {draftStrategy.allocations.map((alloc) => (
                  <DraftAllocation key={`${alloc.poolId}-${alloc.protocol}`} allocation={alloc} />
                ))}
              </div>
              <div className="filter-row" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setJob({ status: "idle", progress: 0 })}
                  disabled={activateBusy}
                >
                  <CirclePause size={17} aria-hidden="true" /> Discard
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={activate}
                  disabled={activateBusy}
                >
                  <Play size={17} aria-hidden="true" />
                  {activateBusy ? "Activating…" : "Place under monitor"}
                </button>
              </div>
              {draftStrategy.warnings.length > 0 ? (
                <p style={{ marginTop: 10, fontSize: 12, color: "var(--gold)" }}>
                  {draftStrategy.warnings[0]}
                </p>
              ) : null}
            </div>
          ) : (
            <button className="ghost-button" type="button" style={{ marginTop: 16 }}>
              Generated draft will appear here
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function DraftAllocation({ allocation }: { allocation: StrategyAllocation }) {
  const chain = chainIdFromName(allocation.chain);
  return (
    <div className="composer-allocation">
      <div className="token-cell">
        <PoolIcon symbol={allocation.symbol} protocol={allocation.protocol} />
        <div>
          <strong>{allocation.symbol}</strong>
          <span>{allocation.protocol} · {formatMoney(allocation.allocationAmount)}</span>
          {allocation.reasoning ? <small>{allocation.reasoning}</small> : null}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <strong>{allocation.allocationPercent.toFixed(0)}%</strong>
        <ChainBadge chain={chain} />
      </div>
    </div>
  );
}

function StrategyArticle({
  strategy,
  onScan,
  scanBusy,
  onPause,
  onResume,
  onArchive,
  onDelete,
}: {
  strategy: ActiveStrategy;
  onScan: () => void;
  scanBusy: boolean;
  onPause: () => void;
  onResume: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const risk = useMemo<RiskBand>(() => {
    switch (strategy.criteria.riskAppetite) {
      case "low":
        return "Conservative";
      case "high":
        return "Asymmetric";
      default:
        return "Balanced";
    }
  }, [strategy.criteria.riskAppetite]);
  const tone = STATUS_TONE[strategy.status];
  return (
    <article className="strategy-card">
      <div className="strategy-head">
        <div>
          <RiskPill risk={risk} />
          <h3>{strategy.strategy.summary?.split(".")[0] ?? "Allocation mandate"}</h3>
          <p>
            {formatMoney(strategy.totalBudget)} tracked at {formatPct(strategy.projectedApy)} projected APY ·{" "}
            {strategy.strategy.allocations.length} markets
          </p>
        </div>
        <span className={`command-chip tone-${tone}`} style={{ borderRadius: 4 }}>
          <em>status</em>
          <strong>{strategy.status}</strong>
        </span>
      </div>

      {(strategy.alertCount ?? 0) > 0 ? (
        <p className="severity-high" style={{ marginTop: 6, fontSize: 12, fontFamily: "var(--font-mono)" }}>
          {strategy.alertCount} alert{(strategy.alertCount ?? 0) === 1 ? "" : "s"} · open the bell to review
        </p>
      ) : null}

      <div className="allocation-list">
        {strategy.strategy.allocations.slice(0, expanded ? undefined : 4).map((alloc) => {
          const chain = chainIdFromName(alloc.chain);
          return (
            <div className="allocation-row" key={`${strategy.id}-${alloc.poolId}`}>
              <div className="token-cell">
                <PoolIcon symbol={alloc.symbol} protocol={alloc.protocol} />
                <div>
                  <strong>{alloc.symbol}</strong>
                  <span>
                    {alloc.protocol} · {formatPct(alloc.apy)} entry · {formatMoney(alloc.allocationAmount)}
                  </span>
                </div>
              </div>
              <strong>{alloc.allocationPercent.toFixed(0)}%</strong>
              <ChainBadge chain={chain} />
            </div>
          );
        })}
      </div>

      {strategy.strategy.allocations.length > 4 ? (
        <button
          type="button"
          className="ghost-button"
          onClick={() => setExpanded((v) => !v)}
          style={{ marginTop: 12 }}
        >
          {expanded ? "Collapse" : `Show all ${strategy.strategy.allocations.length} markets`}
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      ) : null}

      <div className="filter-row" style={{ marginTop: 14 }}>
        {strategy.status === "active" ? (
          <button type="button" className="secondary-button" onClick={onPause}>
            <CirclePause size={15} aria-hidden="true" /> Pause
          </button>
        ) : strategy.status === "paused" ? (
          <button type="button" className="secondary-button" onClick={onResume}>
            <Play size={15} aria-hidden="true" /> Resume
          </button>
        ) : null}
        {strategy.status !== "archived" ? (
          <button type="button" className="ghost-button" onClick={onArchive}>
            Archive
          </button>
        ) : null}
        {strategy.status === "active" ? (
          <button type="button" className="primary-button" onClick={onScan} disabled={scanBusy}>
            <BellRing size={15} aria-hidden="true" />
            {scanBusy ? "Reviewing…" : "Review now"}
          </button>
        ) : null}
        <button type="button" className="ghost-button" onClick={onDelete} style={{ marginLeft: "auto" }}>
          <Trash2 size={15} aria-hidden="true" /> Delete
        </button>
      </div>
    </article>
  );
}
