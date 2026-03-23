"use client";

import { useState } from "react";
import { useActiveStrategies } from "@/hooks/useActiveStrategies";
import { formatCurrency } from "@/lib/formatters";
import type { ActiveStrategy } from "@/types/active-strategy";

const statusColors: Record<string, string> = {
  active: "bg-accent/15 text-accent",
  paused: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  archived: "bg-muted/15 text-muted",
};

export default function StrategiesPage() {
  const { strategies, isLoading, error, updateStatus, deleteStrategy, runScan } = useActiveStrategies();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ scanned: number; newAlerts: unknown[] } | null>(null);

  const handleScan = async (strategyId?: string) => {
    setScanning(true);
    setScanResult(null);
    try {
      const result = await runScan(strategyId);
      setScanResult(result);
    } catch {
      // Error handled by hook
    } finally {
      setScanning(false);
    }
  };

  const activeCount = strategies.filter((s) => s.status === "active").length;
  const totalBudget = strategies
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.totalBudget, 0);
  const totalAlerts = strategies.reduce((sum, s) => sum + (s.alertCount || 0), 0);

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-14 lg:px-10 space-y-8">
      {/* Hero */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 bg-accent" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            Strategy Monitor
          </span>
        </div>
        <h1 className="text-3xl sm:text-[42px] font-black leading-[0.95] tracking-[-0.04em] text-on-surface">
          Active<br />
          <span className="italic font-light text-accent">Strategies.</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm sm:text-base text-on-surface-variant leading-relaxed">
          Monitor your activated strategies. The system checks pool APYs and alerts you when conditions change.
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface-low border border-outline p-4 sm:p-6">
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">Active</span>
          <span className="text-2xl sm:text-3xl font-black tracking-tight text-accent">{activeCount}</span>
        </div>
        <div className="bg-surface-low border border-outline p-4 sm:p-6">
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">Total Budget</span>
          <span className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">{formatCurrency(totalBudget)}</span>
        </div>
        <div className="bg-surface-low border border-outline p-4 sm:p-6">
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">Unread Alerts</span>
          <span className={`text-2xl sm:text-3xl font-black tracking-tight ${totalAlerts > 0 ? "text-danger" : "text-on-surface"}`}>
            {totalAlerts}
          </span>
        </div>
        <div className="bg-surface-low border border-outline p-4 sm:p-6">
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">Total</span>
          <span className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">{strategies.length}</span>
        </div>
      </div>

      {/* Scan All Button */}
      {activeCount > 0 && (
        <button
          onClick={() => handleScan()}
          disabled={scanning}
          className="w-full bg-cta text-white px-8 py-4 text-sm uppercase font-semibold tracking-[0.08em] flex items-center justify-center gap-3 hover:-translate-y-0.5 transition-all disabled:opacity-50"
        >
          {scanning ? (
            <>
              <div className="w-2 h-2 bg-white animate-pulse" />
              Scanning all active strategies...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">radar</span>
              Run Full Scan
            </>
          )}
        </button>
      )}

      {/* Scan Result */}
      {scanResult && (
        <div className="bg-accent/10 border border-accent/30 p-4">
          <p className="text-sm text-accent font-medium">
            Scanned {scanResult.scanned} {scanResult.scanned === 1 ? "strategy" : "strategies"} —{" "}
            {scanResult.newAlerts.length > 0
              ? `${scanResult.newAlerts.length} new alert${scanResult.newAlerts.length === 1 ? "" : "s"} generated`
              : "no new alerts"}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 p-4">
          <p className="text-sm text-danger font-medium">{error}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-surface-low border border-outline p-8 flex items-center justify-center gap-3">
          <div className="w-2 h-2 bg-accent animate-pulse" />
          <p className="text-sm text-muted">Loading strategies...</p>
        </div>
      )}

      {/* Strategy Cards */}
      {!isLoading && strategies.length === 0 && (
        <div className="bg-surface-low border border-outline p-8 sm:p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-muted mb-3 block">monitoring</span>
          <p className="text-sm text-on-surface-variant mb-4">
            No strategies activated yet. Generate a strategy and click &quot;Activate &amp; Monitor&quot; to start tracking.
          </p>
          <a
            href="/strategy"
            className="inline-block bg-cta text-white px-8 py-3 text-sm uppercase font-semibold tracking-[0.08em] hover:-translate-y-0.5 transition-all"
          >
            Create Strategy
          </a>
        </div>
      )}

      <div className="space-y-4">
        {strategies.map((s) => (
          <StrategyCard
            key={s.id}
            strategy={s}
            onStatusChange={updateStatus}
            onDelete={deleteStrategy}
            onScan={() => handleScan(s.id)}
            scanning={scanning}
          />
        ))}
      </div>
    </div>
  );
}

function StrategyCard({
  strategy: s,
  onStatusChange,
  onDelete,
  onScan,
  scanning,
}: {
  strategy: ActiveStrategy;
  onStatusChange: (id: string, status: "active" | "paused" | "archived") => void;
  onDelete: (id: string) => void;
  onScan: () => void;
  scanning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface-low border border-outline">
      {/* Header */}
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs font-semibold uppercase tracking-[0.1em] px-2.5 py-1 ${statusColors[s.status]}`}>
                {s.status}
              </span>
              {(s.alertCount ?? 0) > 0 && (
                <span className="text-xs font-bold text-danger bg-danger/15 px-2.5 py-1">
                  {s.alertCount} alert{(s.alertCount ?? 0) !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant line-clamp-2">{s.strategy.summary.slice(0, 150)}...</p>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <div className="text-center">
              <span className="text-2xl font-black text-accent tracking-tight">{s.projectedApy.toFixed(1)}%</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-label/70">APY</span>
            </div>
            <div className="text-center">
              <span className="text-2xl font-black text-on-surface tracking-tight">{formatCurrency(s.totalBudget)}</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-label/70">Budget</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          {s.status === "active" && (
            <button
              onClick={() => onStatusChange(s.id, "paused")}
              className="border border-outline px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant hover:border-yellow-500 hover:text-yellow-600 transition-all"
            >
              Pause
            </button>
          )}
          {s.status === "paused" && (
            <button
              onClick={() => onStatusChange(s.id, "active")}
              className="border border-outline px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant hover:border-accent hover:text-accent transition-all"
            >
              Resume
            </button>
          )}
          {s.status !== "archived" && (
            <button
              onClick={() => onStatusChange(s.id, "archived")}
              className="border border-outline px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant hover:border-muted transition-all"
            >
              Archive
            </button>
          )}
          {s.status === "active" && (
            <button
              onClick={onScan}
              disabled={scanning}
              className="border border-accent text-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] hover:bg-accent hover:text-white transition-all disabled:opacity-50"
            >
              {scanning ? "Scanning..." : "Scan Now"}
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="border border-outline px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant hover:border-accent hover:text-accent transition-all"
          >
            {expanded ? "Collapse" : "Details"}
          </button>
          <button
            onClick={() => {
              if (confirm("Delete this strategy and all its alerts?")) onDelete(s.id);
            }}
            className="border border-outline px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted hover:border-danger hover:text-danger transition-all ml-auto"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-outline p-4 sm:p-6 space-y-4">
          <div className="text-xs text-muted">
            Created: {new Date(s.createdAt).toLocaleString()} • {s.strategy.allocations.length} pools •{" "}
            {s.criteria.riskAppetite} risk
          </div>

          {/* Allocations Table */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[1fr_80px_80px_100px_80px] gap-2 px-3 py-2 border-b border-outline min-w-[500px]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-label/70">Pool</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-label/70">Chain</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-label/70">Entry APY</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-label/70">Allocated</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-label/70">Safety</span>
            </div>
            {s.strategy.allocations.map((alloc, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_80px_80px_100px_80px] gap-2 px-3 py-2.5 border-b border-outline/50 min-w-[500px]"
              >
                <div>
                  <span className="text-sm font-bold text-on-surface">{alloc.protocol}</span>
                  <span className="text-xs text-muted ml-1.5">{alloc.symbol}</span>
                </div>
                <span className="text-sm text-muted">{alloc.chain}</span>
                <span className="text-sm font-bold text-accent">{alloc.apy.toFixed(1)}%</span>
                <span className="text-sm font-medium text-on-surface">{formatCurrency(alloc.allocationAmount)}</span>
                <span className={`text-sm font-bold ${alloc.legitimacyScore >= 70 ? "text-accent" : alloc.legitimacyScore >= 50 ? "text-yellow-600" : "text-danger"}`}>
                  {alloc.legitimacyScore}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
