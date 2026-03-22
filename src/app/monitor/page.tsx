"use client";

import { useState, useEffect } from "react";
import { loadPortfolio, savePortfolio, loadAlertConfig, addPosition, removePosition } from "@/lib/storage";
import { formatCurrency, formatApy } from "@/lib/formatters";
import type { PortfolioPosition, AlertEvent, AlertConfig } from "@/types/portfolio";
import type { RebalanceSuggestion } from "@/lib/rebalancer";

interface EnrichedPosition extends PortfolioPosition {
  currentApy: number | null;
  currentTvl: number | null;
  apyChange: number | null;
  tvlChange: number | null;
}

export default function MonitorPage() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [enriched, setEnriched] = useState<EnrichedPosition[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rebalanceSuggestions, setRebalanceSuggestions] = useState<RebalanceSuggestion[]>([]);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);

  // Add form state
  const [newPoolId, setNewPoolId] = useState("");
  const [newProtocol, setNewProtocol] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newChain, setNewChain] = useState("");
  const [newAmount, setNewAmount] = useState(1000);
  const [newApy, setNewApy] = useState(10);
  const [newTvl, setNewTvl] = useState(1000000);

  useEffect(() => {
    setPositions(loadPortfolio());
  }, []);

  const runScan = async () => {
    if (positions.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const config = loadAlertConfig();
      const res = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions, config }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Scan failed");
      }

      const data = await res.json();
      setAlerts(data.alerts);
      setEnriched(data.positions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Monitor scan failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPosition = () => {
    if (!newPoolId || !newProtocol || !newSymbol) return;
    const pos: PortfolioPosition = {
      id: `pos-${Date.now()}`,
      poolId: newPoolId,
      protocol: newProtocol,
      chain: newChain || "Ethereum",
      symbol: newSymbol,
      investedAmount: newAmount,
      entryApy: newApy,
      entryTvl: newTvl,
      entryDate: new Date().toISOString(),
      riskAppetite: "medium",
    };
    addPosition(pos);
    setPositions(loadPortfolio());
    setShowAdd(false);
    setNewPoolId("");
    setNewProtocol("");
    setNewSymbol("");
    setNewChain("");
  };

  const runRebalance = async () => {
    if (positions.length === 0) return;
    setRebalanceLoading(true);
    try {
      const res = await fetch("/api/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions }),
      });
      if (!res.ok) throw new Error("Rebalance failed");
      const data = await res.json();
      setRebalanceSuggestions(data.suggestions || []);
    } catch {
      setRebalanceSuggestions([]);
    } finally {
      setRebalanceLoading(false);
    }
  };

  const handleRemove = (id: string) => {
    removePosition(id);
    setPositions(loadPortfolio());
    setEnriched(enriched.filter((e) => e.id !== id));
  };

  const severityColor = {
    critical: "text-error bg-error/10 border-error",
    warning: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    info: "text-primary bg-primary/10 border-primary/30",
  };

  const severityIcon = {
    critical: "error",
    warning: "warning",
    info: "info",
  };

  return (
    <div className="p-8">
      {/* Hero */}
      <section className="mb-8">
        <span className="font-label uppercase tracking-[0.3em] text-[10px] text-secondary-dim font-bold mb-4 block">
          Portfolio Intelligence
        </span>
        <h2 className="font-headline text-5xl md:text-7xl font-light leading-none mb-4 tracking-tighter text-on-surface">
          Portfolio <br />
          <span className="italic text-primary">Monitor.</span>
        </h2>
        <p className="font-body text-on-surface-variant max-w-xl text-sm leading-relaxed">
          Track your DeFi positions in real-time. Get alerts for APY drops, TVL drains,
          and protocol exploits. Add positions manually or from your strategy results.
        </p>
      </section>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-surface-highest text-on-surface px-4 py-2 text-[10px] uppercase font-bold tracking-widest hover:bg-surface-high transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Position
        </button>
        <button
          onClick={runScan}
          disabled={loading || positions.length === 0}
          className={`px-6 py-2 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-all ${
            loading || positions.length === 0 ? "bg-surface-high text-on-surface-variant" : "bg-primary text-on-primary hover:bg-primary-dim"
          }`}
        >
          {loading ? (
            <>
              <div className="w-2 h-2 bg-primary animate-pulse" />
              Scanning...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">radar</span>
              Run Scan ({positions.length} positions)
            </>
          )}
        </button>
        <button
          onClick={runRebalance}
          disabled={rebalanceLoading || positions.length === 0}
          className={`px-6 py-2 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-all ${
            rebalanceLoading || positions.length === 0 ? "bg-surface-high text-on-surface-variant" : "bg-surface-highest text-on-surface hover:text-primary"
          }`}
        >
          {rebalanceLoading ? (
            <>
              <div className="w-2 h-2 bg-primary animate-pulse" />
              Finding better yields...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">swap_horiz</span>
              Rebalance Suggestions
            </>
          )}
        </button>
      </div>

      {/* Add Position Form */}
      {showAdd && (
        <div className="bg-surface-lowest border-l-4 border-primary p-6 mb-6 max-w-2xl">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-4 block">
            Add Position
          </span>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Pool ID" value={newPoolId} onChange={(e) => setNewPoolId(e.target.value)}
              className="bg-surface-low border-b border-outline-variant/30 text-[11px] px-3 py-2 outline-none text-on-surface placeholder:text-on-surface-variant" />
            <input placeholder="Protocol (e.g. aave-v3)" value={newProtocol} onChange={(e) => setNewProtocol(e.target.value)}
              className="bg-surface-low border-b border-outline-variant/30 text-[11px] px-3 py-2 outline-none text-on-surface placeholder:text-on-surface-variant" />
            <input placeholder="Symbol (e.g. USDC)" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)}
              className="bg-surface-low border-b border-outline-variant/30 text-[11px] px-3 py-2 outline-none text-on-surface placeholder:text-on-surface-variant" />
            <input placeholder="Chain (e.g. Ethereum)" value={newChain} onChange={(e) => setNewChain(e.target.value)}
              className="bg-surface-low border-b border-outline-variant/30 text-[11px] px-3 py-2 outline-none text-on-surface placeholder:text-on-surface-variant" />
            <input type="number" placeholder="Invested ($)" value={newAmount} onChange={(e) => setNewAmount(Number(e.target.value))}
              className="bg-surface-low border-b border-outline-variant/30 text-[11px] px-3 py-2 outline-none text-on-surface" />
            <input type="number" placeholder="Entry APY (%)" value={newApy} onChange={(e) => setNewApy(Number(e.target.value))}
              className="bg-surface-low border-b border-outline-variant/30 text-[11px] px-3 py-2 outline-none text-on-surface" />
          </div>
          <button onClick={handleAddPosition}
            className="mt-4 bg-primary text-on-primary px-6 py-2 text-[10px] uppercase font-bold tracking-widest hover:bg-primary-dim transition-all">
            Save Position
          </button>
        </div>
      )}

      {error && (
        <div className="bg-error-container/20 border-l-2 border-error p-4 mb-6">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-8">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-4 block">
            Active Alerts ({alerts.length})
          </span>
          <div className="space-y-[1px]">
            {alerts.map((alert) => (
              <div key={alert.id} className={`p-4 border-l-4 bg-surface-low flex items-start gap-3 ${severityColor[alert.severity]}`}>
                <span className="material-symbols-outlined text-lg mt-0.5">{severityIcon[alert.severity]}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-widest font-bold">{alert.severity}</span>
                    <span className="text-on-surface text-sm font-label font-bold">{alert.protocol}</span>
                    <span className="text-on-surface-variant text-[10px]">{alert.symbol} &middot; {alert.chain}</span>
                  </div>
                  <p className="text-on-surface text-[12px] mt-1">{alert.message}</p>
                  <p className="text-on-surface-variant text-[10px] mt-0.5">{alert.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Positions Table */}
      <div>
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-4 block">
          Tracked Positions ({positions.length})
        </span>

        {positions.length === 0 ? (
          <div className="bg-surface-lowest p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2 block">account_balance_wallet</span>
            <p className="text-on-surface-variant text-sm">No positions tracked. Add a position to start monitoring.</p>
          </div>
        ) : (
          <div className="space-y-[1px]">
            <div className="grid grid-cols-8 gap-4 text-[9px] uppercase tracking-widest text-on-surface-variant font-bold bg-surface-high p-3">
              <span>Protocol</span>
              <span>Symbol</span>
              <span>Chain</span>
              <span className="text-right">Invested</span>
              <span className="text-right">Entry APY</span>
              <span className="text-right">Current APY</span>
              <span className="text-right">APY Change</span>
              <span></span>
            </div>
            {(enriched.length > 0 ? enriched : positions).map((pos) => {
              const e = pos as EnrichedPosition;
              return (
                <div key={pos.id} className="grid grid-cols-8 gap-4 text-[11px] bg-surface-low hover:bg-surface-high transition-all p-3 items-center">
                  <span className="text-on-surface font-label font-bold">{pos.protocol}</span>
                  <span className="text-on-surface-variant">{pos.symbol}</span>
                  <span className="text-on-surface-variant">{pos.chain}</span>
                  <span className="text-right text-on-surface">{formatCurrency(pos.investedAmount)}</span>
                  <span className="text-right text-on-surface">{formatApy(pos.entryApy)}</span>
                  <span className="text-right text-primary">
                    {e.currentApy != null ? formatApy(e.currentApy) : "—"}
                  </span>
                  <span className={`text-right font-bold ${
                    e.apyChange != null ? (e.apyChange >= 0 ? "text-green-400" : "text-error") : ""
                  }`}>
                    {e.apyChange != null ? `${e.apyChange >= 0 ? "+" : ""}${e.apyChange.toFixed(1)}%` : "—"}
                  </span>
                  <button
                    onClick={() => handleRemove(pos.id)}
                    className="text-on-surface-variant hover:text-error transition-all ml-auto"
                    title="Remove position"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rebalance Suggestions */}
      {rebalanceSuggestions.length > 0 && (
        <div className="mt-8">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-4 block">
            Rebalance Suggestions ({rebalanceSuggestions.length})
          </span>
          <div className="space-y-[1px]">
            {rebalanceSuggestions.map((s, i) => (
              <div key={i} className="bg-surface-low hover:bg-surface-high transition-all p-5">
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-xl font-headline text-primary/30">{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-on-surface-variant text-[11px]">{s.currentProtocol} ({s.currentSymbol})</span>
                    <span className="text-on-surface-variant text-[11px]">{s.currentApy.toFixed(2)}%</span>
                    <span className="material-symbols-outlined text-primary text-lg">arrow_forward</span>
                    <span className="text-on-surface text-[11px] font-bold">{s.suggestedProtocol} ({s.suggestedSymbol})</span>
                    <span className="text-green-400 text-[11px] font-bold">{s.suggestedApy.toFixed(2)}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-green-400 font-headline text-lg">+{formatCurrency(s.yearlyGain)}/yr</span>
                    <span className="text-[9px] text-on-surface-variant block">+{s.apyImprovement.toFixed(2)}% APY</span>
                  </div>
                  <a
                    href={`https://defillama.com/yields/pool/${s.suggestedPoolId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 px-4 bg-primary text-on-primary flex items-center justify-center gap-1 text-[10px] uppercase font-bold tracking-widest hover:bg-primary-dim transition-all"
                  >
                    Move <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </a>
                </div>
                <p className="text-[10px] text-on-surface-variant ml-10">{s.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
