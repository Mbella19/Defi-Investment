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
    critical: "bg-[#ff4d4d]/10 text-[#ff4d4d]",
    warning: "bg-[#ff6c12]/10 text-[#ff6c12]",
    info: "bg-[#00D4AA]/10 text-[#00896e]",
  };

  const severityIcon = {
    critical: "error",
    warning: "warning",
    info: "info",
  };

  return (
    <div className="px-6 lg:px-10 py-12">
      {/* Hero */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-2 bg-[#00D4AA]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            Portfolio Intelligence
          </span>
        </div>
        <h2 className="text-5xl font-black leading-none mb-5 tracking-[-0.05em] text-[#203241]">
          Portfolio <br />
          <span className="italic text-[#00D4AA]">Monitor.</span>
        </h2>
        <p className="text-[#6b7781] max-w-xl text-sm leading-relaxed">
          Track your DeFi positions in real-time. Get alerts for APY drops, TVL drains,
          and protocol exploits. Add positions manually or from your strategy results.
        </p>
      </section>

      {/* Actions */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-white text-[#203241] px-8 py-4 text-[11px] uppercase font-semibold tracking-[0.15em] hover:border-[#00D4AA] border border-[#d7dade] transition-all duration-300 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Position
        </button>
        <button
          onClick={runScan}
          disabled={loading || positions.length === 0}
          className={`px-8 py-4 text-[11px] uppercase font-semibold tracking-[0.15em] flex items-center gap-2 transition-all duration-300 ${
            loading || positions.length === 0
              ? "bg-[#f2f3f5] text-[#6b7781] border border-[#d7dade]"
              : "bg-[#ff6c12] text-white hover:bg-[#e55f0a]"
          }`}
        >
          {loading ? (
            <>
              <div className="w-2 h-2 bg-[#00D4AA] animate-pulse" />
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
          className={`px-8 py-4 text-[11px] uppercase font-semibold tracking-[0.15em] flex items-center gap-2 transition-all duration-300 border ${
            rebalanceLoading || positions.length === 0
              ? "bg-[#f2f3f5] text-[#6b7781] border-[#d7dade]"
              : "bg-white text-[#203241] border-[#2a3a46] hover:text-[#00D4AA] hover:border-[#00D4AA]"
          }`}
        >
          {rebalanceLoading ? (
            <>
              <div className="w-2 h-2 bg-[#00D4AA] animate-pulse" />
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
        <div className="bg-[#f2f3f5] border border-[#d7dade] p-8 mb-8 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 bg-[#00D4AA]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
              Add Position
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Pool ID" value={newPoolId} onChange={(e) => setNewPoolId(e.target.value)}
              className="bg-white border border-[#d7dade] text-sm px-4 py-3 outline-none text-[#203241] placeholder:text-[#6b7781] focus:border-[#00D4AA] transition-all duration-300" />
            <input placeholder="Protocol (e.g. aave-v3)" value={newProtocol} onChange={(e) => setNewProtocol(e.target.value)}
              className="bg-white border border-[#d7dade] text-sm px-4 py-3 outline-none text-[#203241] placeholder:text-[#6b7781] focus:border-[#00D4AA] transition-all duration-300" />
            <input placeholder="Symbol (e.g. USDC)" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)}
              className="bg-white border border-[#d7dade] text-sm px-4 py-3 outline-none text-[#203241] placeholder:text-[#6b7781] focus:border-[#00D4AA] transition-all duration-300" />
            <input placeholder="Chain (e.g. Ethereum)" value={newChain} onChange={(e) => setNewChain(e.target.value)}
              className="bg-white border border-[#d7dade] text-sm px-4 py-3 outline-none text-[#203241] placeholder:text-[#6b7781] focus:border-[#00D4AA] transition-all duration-300" />
            <input type="number" placeholder="Invested ($)" value={newAmount} onChange={(e) => setNewAmount(Number(e.target.value))}
              className="bg-white border border-[#d7dade] text-sm px-4 py-3 outline-none text-[#203241] placeholder:text-[#6b7781] focus:border-[#00D4AA] transition-all duration-300" />
            <input type="number" placeholder="Entry APY (%)" value={newApy} onChange={(e) => setNewApy(Number(e.target.value))}
              className="bg-white border border-[#d7dade] text-sm px-4 py-3 outline-none text-[#203241] placeholder:text-[#6b7781] focus:border-[#00D4AA] transition-all duration-300" />
          </div>
          <button onClick={handleAddPosition}
            className="mt-6 bg-[#ff6c12] text-white px-8 py-4 text-[11px] uppercase font-semibold tracking-[0.15em] hover:bg-[#e55f0a] transition-all duration-300">
            Save Position
          </button>
        </div>
      )}

      {error && (
        <div className="bg-[#ff4d4d]/10 border border-[#ff4d4d]/20 p-6 mb-8">
          <p className="text-[#ff4d4d] text-sm">{error}</p>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-2 h-2 bg-[#ff4d4d]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
              Active Alerts ({alerts.length})
            </span>
          </div>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className={`p-6 border border-[#d7dade] bg-white flex items-start gap-4 transition-all duration-300 ${severityColor[alert.severity]}`}>
                <span className="material-symbols-outlined text-lg mt-0.5">{severityIcon[alert.severity]}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] uppercase tracking-[0.15em] font-semibold px-2 py-0.5 ${severityColor[alert.severity]}`}>
                      {alert.severity}
                    </span>
                    <span className="text-[#203241] text-sm font-semibold">{alert.protocol}</span>
                    <span className="text-[#6b7781] text-[11px]">{alert.symbol} &middot; {alert.chain}</span>
                  </div>
                  <p className="text-[#43515d] text-[12px] mt-2">{alert.message}</p>
                  <p className="text-[#6b7781] text-[11px] mt-1">{alert.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Positions Table */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-2 h-2 bg-[#00D4AA]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
            Tracked Positions ({positions.length})
          </span>
        </div>

        {positions.length === 0 ? (
          <div className="bg-[#f2f3f5] border border-[#d7dade] p-16 text-center">
            <span className="material-symbols-outlined text-4xl text-[#6b7781] mb-3 block">account_balance_wallet</span>
            <p className="text-[#6b7781] text-sm">No positions tracked. Add a position to start monitoring.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#d7dade] overflow-hidden">
            <div className="grid grid-cols-8 gap-4 text-[10px] uppercase tracking-[0.15em] text-[#6b7781] font-semibold bg-[#f2f3f5] px-8 py-4">
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
                <div key={pos.id} className="grid grid-cols-8 gap-4 text-[12px] hover:bg-[#f2f3f5] transition-all duration-300 px-8 py-4 items-center border-t border-[#e2e3e7]">
                  <span className="text-[#203241] font-semibold">{pos.protocol}</span>
                  <span className="text-[#6b7781]">{pos.symbol}</span>
                  <span className="text-[#6b7781]">{pos.chain}</span>
                  <span className="text-right text-[#203241]">{formatCurrency(pos.investedAmount)}</span>
                  <span className="text-right text-[#203241]">{formatApy(pos.entryApy)}</span>
                  <span className="text-right text-[#00D4AA]">
                    {e.currentApy != null ? formatApy(e.currentApy) : "\u2014"}
                  </span>
                  <span className={`text-right font-semibold ${
                    e.apyChange != null ? (e.apyChange >= 0 ? "text-[#00D4AA]" : "text-[#ff4d4d]") : ""
                  }`}>
                    {e.apyChange != null ? `${e.apyChange >= 0 ? "+" : ""}${e.apyChange.toFixed(1)}%` : "\u2014"}
                  </span>
                  <button
                    onClick={() => handleRemove(pos.id)}
                    className="text-[#6b7781] hover:text-[#ff4d4d] transition-all duration-300 ml-auto"
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
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-2 h-2 bg-[#dce61a]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
              Rebalance Suggestions ({rebalanceSuggestions.length})
            </span>
          </div>
          <div className="space-y-2">
            {rebalanceSuggestions.map((s, i) => (
              <div key={i} className="bg-white border border-[#d7dade] hover:border-[#00D4AA] transition-all duration-300 p-8">
                <div className="flex items-center gap-5 mb-3">
                  <span className="text-2xl font-black tracking-[-0.05em] text-[#00D4AA]/30">{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-[#6b7781] text-[12px]">{s.currentProtocol} ({s.currentSymbol})</span>
                    <span className="text-[#6b7781] text-[12px]">{s.currentApy.toFixed(2)}%</span>
                    <span className="material-symbols-outlined text-[#00D4AA] text-lg">arrow_forward</span>
                    <span className="text-[#203241] text-[12px] font-semibold">{s.suggestedProtocol} ({s.suggestedSymbol})</span>
                    <span className="text-[#00D4AA] text-[12px] font-semibold">{s.suggestedApy.toFixed(2)}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#00D4AA] font-black tracking-[-0.05em] text-xl">+{formatCurrency(s.yearlyGain)}/yr</span>
                    <span className="text-[10px] text-[#6b7781] block mt-0.5">+{s.apyImprovement.toFixed(2)}% APY</span>
                  </div>
                  <a
                    href={`https://defillama.com/yields/pool/${s.suggestedPoolId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#ff6c12] text-white px-8 py-4 flex items-center justify-center gap-2 text-[11px] uppercase font-semibold tracking-[0.15em] hover:bg-[#e55f0a] transition-all duration-300"
                  >
                    Move <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </a>
                </div>
                <p className="text-[11px] text-[#6b7781] ml-12">{s.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
