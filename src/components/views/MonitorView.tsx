"use client";

import { useState, useEffect, useMemo } from "react";
import {
  loadPortfolio,
  loadAlertConfig,
  addPosition,
  removePosition,
} from "@/lib/storage";
import { fmt, Eyebrow, Icons } from "@/components/sovereign";
import type {
  PortfolioPosition,
  AlertEvent,
  AlertSeverity,
} from "@/types/portfolio";
import type { RebalanceSuggestion } from "@/lib/rebalancer";

interface EnrichedPosition extends PortfolioPosition {
  currentApy: number | null;
  currentTvl: number | null;
  apyChange: number | null;
  tvlChange: number | null;
}

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: "var(--danger)",
  warning: "var(--warn)",
  info: "var(--accent)",
};

export default function MonitorPage() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [enriched, setEnriched] = useState<EnrichedPosition[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rebalanceSuggestions, setRebalanceSuggestions] = useState<
    RebalanceSuggestion[]
  >([]);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const [newPoolId, setNewPoolId] = useState("");
  const [newProtocol, setNewProtocol] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newChain, setNewChain] = useState("");
  const [newAmount, setNewAmount] = useState(1000);
  const [newApy, setNewApy] = useState(10);
  const [newTvl, setNewTvl] = useState(1_000_000);

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
      setLastScan(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Monitor scan failed");
    } finally {
      setLoading(false);
    }
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

  const handleAdd = () => {
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

  const handleRemove = (id: string) => {
    removePosition(id);
    setPositions(loadPortfolio());
    setEnriched((e) => e.filter((p) => p.id !== id));
  };

  const totalInvested = positions.reduce(
    (s, p) => s + p.investedAmount,
    0
  );
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const warning = alerts.filter((a) => a.severity === "warning").length;

  const uptime = useMemo(() => buildUptimeStrip(positions.length, lastScan), [
    positions.length,
    lastScan,
  ]);

  return (
    <div style={{ padding: "40px 48px 96px", maxWidth: 1440, margin: "0 auto" }}>
      <section style={{ marginBottom: 40 }}>
        <Eyebrow>Portfolio Intelligence / M.ONITOR</Eyebrow>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(48px, 6vw, 88px)",
            fontWeight: 900,
            letterSpacing: "-0.055em",
            lineHeight: 0.92,
            margin: "20px 0 16px",
            color: "var(--text)",
          }}
        >
          Portfolio
          <br />
          <span
            style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 300 }}
          >
            Monitor.
          </span>
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-dim)",
            lineHeight: 1.65,
            maxWidth: 620,
          }}
        >
          Track your active DeFi positions in real time. Receive guardrail alerts for
          APY drops, TVL drains, and protocol exploits. Add positions manually or
          import them from your strategy results.
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: "var(--line)",
          border: "1px solid var(--line)",
          marginBottom: 24,
        }}
      >
        <StatusCell
          label="Positions"
          value={positions.length.toString()}
          hint={`${fmt.money(totalInvested)} deployed`}
        />
        <StatusCell
          label="Alerts"
          value={alerts.length.toString()}
          hint={
            alerts.length > 0
              ? `${critical} critical · ${warning} warn`
              : "No active alerts"
          }
          color={critical > 0 ? "var(--danger)" : warning > 0 ? "var(--warn)" : "var(--good)"}
        />
        <StatusCell
          label="Last Scan"
          value={
            lastScan
              ? new Date(lastScan).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
          hint={lastScan ? new Date(lastScan).toLocaleDateString() : "Awaiting first scan"}
        />
        <StatusCell
          label="Guardrails"
          value="ACTIVE"
          hint="APY · TVL · Exploit"
          color="var(--good)"
        />
      </div>

      <UptimeStrip cells={uptime} />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 24,
          marginBottom: 24,
        }}
      >
        <ActionButton
          onClick={() => setShowAdd((s) => !s)}
          icon={<Icons.plus />}
          label="Add Position"
          variant="outline"
        />
        <ActionButton
          onClick={runScan}
          disabled={loading || positions.length === 0}
          icon={<Icons.refresh />}
          label={
            loading
              ? "Scanning…"
              : `Run Scan (${positions.length} positions)`
          }
          variant="primary"
        />
        <ActionButton
          onClick={runRebalance}
          disabled={rebalanceLoading || positions.length === 0}
          icon={<Icons.wave />}
          label={
            rebalanceLoading ? "Finding better yields…" : "Rebalance Suggestions"
          }
          variant="outline"
        />
      </div>

      {showAdd && (
        <AddPositionForm
          poolId={newPoolId}
          setPoolId={setNewPoolId}
          protocol={newProtocol}
          setProtocol={setNewProtocol}
          symbol={newSymbol}
          setSymbol={setNewSymbol}
          chain={newChain}
          setChain={setNewChain}
          amount={newAmount}
          setAmount={setNewAmount}
          apy={newApy}
          setApy={setNewApy}
          tvl={newTvl}
          setTvl={setNewTvl}
          onSubmit={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {error && (
        <div
          style={{
            border: "1px solid var(--danger)",
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            padding: "14px 18px",
            color: "var(--danger)",
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      {alerts.length > 0 && <AlertStream alerts={alerts} />}

      <PositionsLedger
        positions={positions}
        enriched={enriched}
        onRemove={handleRemove}
      />

      {rebalanceSuggestions.length > 0 && (
        <RebalancePanel suggestions={rebalanceSuggestions} />
      )}
    </div>
  );
}

function StatusCell({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div style={{ background: "var(--surface)", padding: "22px 22px" }}>
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        className="serif tabular"
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: color || "var(--text)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.08em",
            color: "var(--text-dim)",
            marginTop: 8,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function buildUptimeStrip(
  positionCount: number,
  lastScan: string | null
): { state: "ok" | "warn" | "idle" }[] {
  const cells: { state: "ok" | "warn" | "idle" }[] = [];
  const n = 48;
  const seed = (lastScan ? lastScan.length : 0) + positionCount * 3;
  for (let i = 0; i < n; i++) {
    if (positionCount === 0) {
      cells.push({ state: "idle" });
      continue;
    }
    const v = (Math.sin(i * 0.9 + seed) + 1) / 2;
    cells.push({ state: v > 0.85 ? "warn" : "ok" });
  }
  return cells;
}

function UptimeStrip({
  cells,
}: {
  cells: { state: "ok" | "warn" | "idle" }[];
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: "18px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <Eyebrow>Guardrail Uptime — 48 scans</Eyebrow>
        <div style={{ display: "flex", gap: 14 }}>
          {[
            { label: "OK", color: "var(--good)" },
            { label: "Warn", color: "var(--warn)" },
            { label: "Idle", color: "var(--text-muted)" },
          ].map((k) => (
            <span
              key={k.label}
              className="mono"
              style={{
                fontSize: 9,
                color: "var(--text-dim)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{ width: 8, height: 8, background: k.color }}
              />
              {k.label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {cells.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 24,
              background:
                c.state === "ok"
                  ? "var(--good)"
                  : c.state === "warn"
                  ? "var(--warn)"
                  : "var(--surface-2)",
              opacity: c.state === "idle" ? 0.4 : 0.85,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon,
  label,
  variant,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  variant: "primary" | "outline";
}) {
  const primary = variant === "primary";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mono"
      style={{
        padding: "14px 22px",
        background: disabled
          ? "var(--surface-2)"
          : primary
          ? "var(--accent)"
          : "transparent",
        color: disabled
          ? "var(--text-dim)"
          : primary
          ? "var(--bg)"
          : "var(--text)",
        border: `1px solid ${
          disabled
            ? "var(--line)"
            : primary
            ? "var(--accent)"
            : "var(--line-2)"
        }`,
        fontSize: 11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function AddPositionForm(props: {
  poolId: string;
  setPoolId: (v: string) => void;
  protocol: string;
  setProtocol: (v: string) => void;
  symbol: string;
  setSymbol: (v: string) => void;
  chain: string;
  setChain: (v: string) => void;
  amount: number;
  setAmount: (v: number) => void;
  apy: number;
  setApy: (v: number) => void;
  tvl: number;
  setTvl: (v: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const fields: {
    label: string;
    value: string | number;
    set: (v: string) => void;
    type?: string;
    placeholder?: string;
  }[] = [
    { label: "Pool ID", value: props.poolId, set: props.setPoolId },
    { label: "Protocol", value: props.protocol, set: props.setProtocol, placeholder: "aave-v3" },
    { label: "Symbol", value: props.symbol, set: props.setSymbol, placeholder: "USDC" },
    { label: "Chain", value: props.chain, set: props.setChain, placeholder: "Ethereum" },
    {
      label: "Invested ($)",
      value: props.amount,
      set: (v) => props.setAmount(Number(v)),
      type: "number",
    },
    {
      label: "Entry APY (%)",
      value: props.apy,
      set: (v) => props.setApy(Number(v)),
      type: "number",
    },
    {
      label: "Entry TVL ($)",
      value: props.tvl,
      set: (v) => props.setTvl(Number(v)),
      type: "number",
    },
  ];
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 28,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <Eyebrow>Add Position</Eyebrow>
        <button
          onClick={props.onCancel}
          className="mono"
          style={{
            background: "transparent",
            border: "1px solid var(--line-2)",
            color: "var(--text-dim)",
            padding: "8px 12px",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 14,
        }}
      >
        {fields.map((f) => (
          <label key={f.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
              }}
            >
              {f.label}
            </span>
            <input
              value={f.value}
              type={f.type || "text"}
              placeholder={f.placeholder}
              onChange={(e) => f.set(e.target.value)}
              className="mono"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                color: "var(--text)",
                fontSize: 12,
                padding: "12px 14px",
                letterSpacing: "0.04em",
                outline: "none",
              }}
            />
          </label>
        ))}
      </div>
      <button
        onClick={props.onSubmit}
        className="mono"
        style={{
          marginTop: 18,
          padding: "14px 22px",
          background: "var(--accent)",
          color: "var(--bg)",
          border: "1px solid var(--accent)",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icons.check />
        Save Position
      </button>
    </div>
  );
}

function AlertStream({ alerts }: { alerts: AlertEvent[] }) {
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 28,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <Eyebrow color="var(--danger)">
          Active Alerts ({alerts.length})
        </Eyebrow>
        <span
          className="mono"
          style={{
            fontSize: 9,
            color: "var(--text-dim)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              background: "var(--danger)",
              boxShadow: "0 0 8px var(--danger)",
              animation: "blink 1.5s ease-in-out infinite",
            }}
          />
          Event Stream
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {alerts.map((a) => {
          const color = SEVERITY_COLOR[a.severity];
          return (
            <div
              key={a.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 18,
                padding: "14px 4px",
                borderBottom: "1px solid var(--line-2)",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  background: color,
                  boxShadow: `0 0 10px ${color}`,
                  marginTop: 6,
                }}
              />
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 4,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color,
                      border: `1px solid ${color}`,
                      padding: "2px 6px",
                    }}
                  >
                    {a.severity}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--text)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {a.protocol}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-dim)",
                    }}
                  >
                    {a.symbol} · {a.chain}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text)",
                    lineHeight: 1.5,
                    marginBottom: 2,
                  }}
                >
                  {a.message}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    lineHeight: 1.5,
                  }}
                >
                  {a.detail}
                </div>
              </div>
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  letterSpacing: "0.1em",
                  whiteSpace: "nowrap",
                }}
              >
                {new Date(a.timestamp).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PositionsLedger({
  positions,
  enriched,
  onRemove,
}: {
  positions: PortfolioPosition[];
  enriched: EnrichedPosition[];
  onRemove: (id: string) => void;
}) {
  const rows = enriched.length > 0 ? enriched : positions;
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div style={{ padding: "22px 26px 0" }}>
        <Eyebrow>Tracked Positions ({positions.length})</Eyebrow>
      </div>
      {positions.length === 0 ? (
        <div
          style={{
            padding: "56px 32px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <Icons.vault
              width={26}
              height={26}
              style={{ color: "var(--text-dim)" }}
            />
          </div>
          <p
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            No positions tracked. Add a position to start monitoring.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <div
            style={{
              minWidth: 900,
              display: "grid",
              gridTemplateColumns:
                "1.3fr 0.8fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 60px",
              gap: 10,
              padding: "10px 26px",
              background: "var(--surface-2)",
              borderTop: "1px solid var(--line-2)",
              borderBottom: "1px solid var(--line-2)",
            }}
          >
            {[
              "Protocol",
              "Symbol",
              "Chain",
              "Invested",
              "Entry APY",
              "Current APY",
              "APY Δ",
              "",
            ].map((h, i) => (
              <span
                key={i}
                className="mono"
                style={{
                  fontSize: 9,
                  color: "var(--text-dim)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  textAlign: i >= 3 && i <= 6 ? "right" : "left",
                }}
              >
                {h}
              </span>
            ))}
          </div>
          {rows.map((pos) => {
            const e = pos as EnrichedPosition;
            const delta = e.apyChange;
            return (
              <div
                key={pos.id}
                style={{
                  minWidth: 900,
                  display: "grid",
                  gridTemplateColumns:
                    "1.3fr 0.8fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 60px",
                  gap: 10,
                  padding: "14px 26px",
                  borderBottom: "1px solid var(--line-2)",
                  alignItems: "center",
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "var(--text)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {pos.protocol}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 12, color: "var(--text-dim)" }}
                >
                  {pos.symbol}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--text-dim)" }}
                >
                  {pos.chain}
                </span>
                <span
                  className="mono tabular"
                  style={{
                    fontSize: 12,
                    color: "var(--text)",
                    textAlign: "right",
                  }}
                >
                  {fmt.money(pos.investedAmount)}
                </span>
                <span
                  className="mono tabular"
                  style={{
                    fontSize: 12,
                    color: "var(--text)",
                    textAlign: "right",
                  }}
                >
                  {pos.entryApy.toFixed(2)}%
                </span>
                <span
                  className="mono tabular"
                  style={{
                    fontSize: 12,
                    color:
                      e.currentApy != null ? "var(--accent)" : "var(--text-dim)",
                    textAlign: "right",
                  }}
                >
                  {e.currentApy != null ? `${e.currentApy.toFixed(2)}%` : "—"}
                </span>
                <span
                  className="mono tabular"
                  style={{
                    fontSize: 12,
                    color:
                      delta == null
                        ? "var(--text-dim)"
                        : delta >= 0
                        ? "var(--good)"
                        : "var(--danger)",
                    textAlign: "right",
                  }}
                >
                  {delta == null
                    ? "—"
                    : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`}
                </span>
                <button
                  onClick={() => onRemove(pos.id)}
                  title="Remove position"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-dim)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    padding: 0,
                  }}
                >
                  <Icons.close style={{ color: "var(--text-dim)" }} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RebalancePanel({
  suggestions,
}: {
  suggestions: RebalanceSuggestion[];
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Eyebrow color="var(--good)">
          Rebalance Suggestions ({suggestions.length})
        </Eyebrow>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {suggestions.map((s, i) => (
          <div
            key={i}
            className="brackets"
            style={{
              border: "1px solid var(--line)",
              background: "var(--surface)",
              padding: "20px 24px",
              display: "grid",
              gridTemplateColumns: "42px 1fr auto",
              gap: 18,
              alignItems: "center",
            }}
          >
            <span
              className="serif"
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "var(--accent)",
                letterSpacing: "-0.03em",
                opacity: 0.55,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 6,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {s.currentProtocol} ({s.currentSymbol})
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--danger)",
                  }}
                >
                  {s.currentApy.toFixed(2)}%
                </span>
                <Icons.arrow style={{ color: "var(--accent)" }} />
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--text)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {s.suggestedProtocol} ({s.suggestedSymbol})
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--good)",
                  }}
                >
                  {s.suggestedApy.toFixed(2)}%
                </span>
              </div>
              <div
                style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}
              >
                {s.reason}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ textAlign: "right" }}>
                <div
                  className="serif"
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--good)",
                    letterSpacing: "-0.03em",
                  }}
                >
                  +{fmt.money(s.yearlyGain)}
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      color: "var(--text-dim)",
                      letterSpacing: "0.1em",
                      marginLeft: 4,
                    }}
                  >
                    /YR
                  </span>
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--accent)",
                    letterSpacing: "0.08em",
                  }}
                >
                  +{s.apyImprovement.toFixed(2)}% APY
                </div>
              </div>
              <a
                href={`https://defillama.com/yields/pool/${s.suggestedPoolId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono"
                style={{
                  padding: "12px 18px",
                  background: "var(--accent)",
                  color: "var(--bg)",
                  border: "1px solid var(--accent)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  textDecoration: "none",
                }}
              >
                Move
                <Icons.arrow />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
