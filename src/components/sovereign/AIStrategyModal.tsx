"use client";

import { useEffect, useState } from "react";
import { Icons } from "./Icons";
import type { InvestmentStrategy, StrategyCriteria } from "@/types/strategy";

type Props = {
  open: boolean;
  onClose: () => void;
  initialBudget?: number;
  initialRisk?: "Safe" | "Balanced" | "Degen";
};

function riskToApi(r: Props["initialRisk"]): StrategyCriteria["riskAppetite"] {
  if (r === "Safe") return "low";
  if (r === "Degen") return "high";
  return "medium";
}

function apyRange(r: Props["initialRisk"]): { min: number; max: number } {
  if (r === "Safe") return { min: 3, max: 8 };
  if (r === "Degen") return { min: 12, max: 60 };
  return { min: 6, max: 18 };
}

export function AIStrategyModal({ open, onClose, initialBudget = 50000, initialRisk = "Balanced" }: Props) {
  const [budget, setBudget] = useState<number>(initialBudget);
  const [risk, setRisk] = useState<"Safe" | "Balanced" | "Degen">(initialRisk);
  const [stablesOnly, setStablesOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvestmentStrategy | null>(null);

  useEffect(() => {
    if (!open) return;
    setBudget(initialBudget);
    setRisk(initialRisk);
    setResult(null);
    setError(null);
  }, [open, initialBudget, initialRisk]);

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
    const range = apyRange(risk);
    const body: StrategyCriteria = {
      budget,
      riskAppetite: riskToApi(risk),
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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Strategy request failed");
      setResult(data as InvestmentStrategy);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Strategy request failed");
    } finally {
      setLoading(false);
    }
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
              AI Strategy
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              Live DeFiLlama pools · Claude proposes, GPT-5.5 reviews, Claude revises
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

        {!result ? (
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
                {(["Safe", "Balanced", "Degen"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRisk(r)}
                    style={{
                      flex: 1,
                      padding: "7px 8px",
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
              Uses live DeFiLlama yields, GoPlus security checks, and a protocol
              risk scorer. No fabricated pools, no placeholder APYs.
            </div>
          </div>
        ) : (
          <StrategyResultView result={result} />
        )}

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
                  disabled={loading || budget < 100}
                  onClick={runStrategy}
                >
                  {loading ? "Thinking…" : "Generate strategy"} {!loading ? <Icons.arrow size={13} /> : null}
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function StrategyResultView({ result }: { result: InvestmentStrategy }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <CollaborationBadge result={result} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ fontSize: 10 }}>
            PROJECTED APY
          </div>
          <div
            className="num display"
            style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}
          >
            {result.projectedApy.toFixed(2)}%
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>
            blended across {result.allocations.length} pools
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
            ${result.projectedYearlyReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>
            at current rates — not guaranteed
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.55 }}>
        {result.summary}
      </div>

      <CollaborationDetails result={result} />


      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          Allocations
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {result.allocations.map((a, i) => (
            <div
              key={`${a.protocol}-${a.poolId}-${i}`}
              className="card"
              style={{ padding: 12 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {a.symbol} <span style={{ color: "var(--text-dim)" }}>· {a.protocol}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
                    {a.chain.toUpperCase()} · APY {a.apy.toFixed(2)}% · TVL $
                    {(a.tvl / 1_000_000).toFixed(1)}M
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontSize: 13, fontWeight: 600 }}>
                    ${a.allocationAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--accent)" }}>
                    {a.allocationPercent.toFixed(1)}%
                  </div>
                </div>
              </div>
              {a.reasoning ? (
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6, lineHeight: 1.5 }}>
                  {a.reasoning}
                </div>
              ) : null}
            </div>
          ))}
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
    </div>
  );
}

function CollaborationBadge({ result }: { result: InvestmentStrategy }) {
  const c = result.collaboration;
  if (!c) return null;
  const total = c.critiquePoints.length;
  const addressed = c.critiquePoints.filter((p) => p.addressed).length;
  const dual = c.bothAisAvailable && c.codexVerdict !== "unavailable";

  let label: string;
  let tone: "good" | "warn" | "info";
  if (!dual) {
    label = "Single-AI fallback (reviewer unavailable)";
    tone = "warn";
  } else if (c.codexVerdict === "approve" && total === 0) {
    label = "Approved by reviewer (no concerns)";
    tone = "good";
  } else {
    label = `${addressed}/${total} reviewer concerns addressed in revision`;
    tone = addressed === total ? "good" : "info";
  }

  const toneColor =
    tone === "good"
      ? "var(--good)"
      : tone === "warn"
        ? "var(--warn)"
        : "var(--accent)";

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
          DUAL-AI COLLABORATION
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-1)" }}>{label}</div>
      </div>
      {dual && c.initialProjectedApy !== c.finalProjectedApy ? (
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
                  background: p.addressed ? "var(--good)" : sevColor,
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
                  {p.issue}
                </div>
                {p.suggestion ? (
                  <div style={{ color: "var(--text-dim)", marginTop: 2 }}>
                    Fix suggested: {p.suggestion}
                  </div>
                ) : null}
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: p.addressed ? "var(--good)" : "var(--text-dim)",
                    marginTop: 3,
                  }}
                >
                  {p.addressed ? "✓ ADDRESSED IN REVISION" : "○ NOTED — KEPT BY CLAUDE WITH JUSTIFICATION"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

export default AIStrategyModal;
