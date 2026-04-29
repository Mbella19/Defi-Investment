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
import {
  chainIdFromName,
  formatMoney,
  formatPct,
  type RiskBand,
} from "@/lib/design-utils";
import { useActiveStrategies } from "@/hooks/useActiveStrategies";
import { useSiweAuth } from "@/hooks/useSiweAuth";
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
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setJob({ status: "running", progress: 0, message: "Preparing allocation workflow…" });
    const [targetApyMin, targetApyMax] = APY_RANGE[risk];
    const criteria: StrategyCriteria = {
      budget,
      riskAppetite: RISK_TO_APPETITE[risk],
      targetApyMin,
      targetApyMax,
      assetType: stableOnly ? "stablecoins" : "all",
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
      const [targetApyMin, targetApyMax] = APY_RANGE[risk];
      const criteria: StrategyCriteria = {
        budget,
        riskAppetite: RISK_TO_APPETITE[risk],
        targetApyMin,
        targetApyMax,
        assetType: stableOnly ? "stablecoins" : "all",
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
          <h1>Mandates that can be inspected.</h1>
          <p>
            Compose an allocation, watch the triple-AI review fire, then move it under
            monitoring. Codex + Gemini veto Claude before any draft is accepted.
          </p>
        </div>
      </div>

      <CommandStrip
        file="file/03.strategies"
        items={[
          { label: "composer", value: job.status === "running" ? "running" : "ready", tone: job.status === "running" ? "warn" : "ok" },
          { label: "review engines", value: "3 online", tone: "info" },
          { label: "veto layer", value: "mandatory", tone: "danger" },
        ]}
      />

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
          {!isAuthed ? (
            <EmptyState
              icon={WandSparkles}
              title="Sign in to monitor allocations"
              body="Connect a wallet and sign the SIWE message — strategies are scoped to the authenticated wallet."
              action={
                <button
                  type="button"
                  className="primary-button"
                  style={{ marginTop: 14 }}
                  onClick={() => signIn().catch(() => {})}
                >
                  <WandSparkles size={16} aria-hidden="true" /> Sign in
                </button>
              }
            />
          ) : isLoading ? (
            <EmptyState icon={RefreshCw} title="Loading mandates" body="Reading wallet-scoped strategies…" />
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
              <select
                className="select-input"
                value={risk}
                onChange={(event) => setRisk(event.target.value as RiskBand)}
              >
                <option value="Conservative">Conservative</option>
                <option value="Balanced">Balanced</option>
                <option value="Asymmetric">Asymmetric</option>
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={stableOnly}
                onChange={(event) => setStableOnly(event.target.checked)}
              />
              Stablecoin sleeves only
            </label>
            <button
              className="primary-button"
              type="button"
              onClick={generate}
              disabled={job.status === "running"}
            >
              <WandSparkles size={18} aria-hidden="true" />
              {job.status === "running" ? "Generating…" : "Generate draft"}
            </button>
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
        <div className="token-chip" aria-hidden="true">
          {allocation.symbol.slice(0, 2)}
        </div>
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
                <div className="token-chip" aria-hidden="true">
                  {alloc.symbol.slice(0, 2)}
                </div>
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
