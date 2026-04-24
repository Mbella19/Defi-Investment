"use client";

import { useState } from "react";
import { fmt, Eyebrow, Icons } from "@/components/sovereign";
import type { InvestmentStrategy } from "@/types/strategy";

interface StrategyResult {
  label: string;
  risk: string;
  strategy: InvestmentStrategy | null;
  error?: string;
  poolsScanned: number;
  protocolsAnalyzed: number;
  protocolsDeepAnalyzed: number;
}

const PRESETS = [5000, 10000, 50000, 100000, 500000];
const COLORS = ["var(--accent)", "var(--good)", "var(--warn)"];

export default function ComparePage() {
  const [budget, setBudget] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<StrategyResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setProgress("Generating Conservative strategy…");
    const t1 = setTimeout(
      () => setProgress("Running deep AI analysis on protocols…"),
      15000
    );
    const t2 = setTimeout(
      () => setProgress("Generating Balanced strategy…"),
      120000
    );
    const t3 = setTimeout(
      () => setProgress("Generating Aggressive strategy…"),
      240000
    );
    const t4 = setTimeout(
      () => setProgress("Finalizing all three strategies…"),
      360000
    );
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget,
          targetApyMin: 1,
          targetApyMax: 500,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Comparison failed");
      }
      const data = await res.json();
      setResults(data.strategies);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate strategies"
      );
    } finally {
      setLoading(false);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    }
  };

  const valid = results.filter((r) => r.strategy);

  return (
    <div style={{ padding: "40px 48px 96px", maxWidth: 1440, margin: "0 auto" }}>
      <section style={{ marginBottom: 40 }}>
        <Eyebrow>Multi-Strategy Analysis / C.MPR</Eyebrow>
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
          Strategy
          <br />
          <span style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 300 }}>
            Comparison.
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
          Generate three strategies side by side — Conservative, Balanced, and
          Aggressive — then compare metrics, allocations, and safety profiles in a
          single pass.
        </p>
      </section>

      {results.length === 0 && !loading && (
        <div
          className="brackets"
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: 28,
            maxWidth: 560,
          }}
        >
          <Eyebrow>Configuration</Eyebrow>
          <div style={{ marginTop: 20 }}>
            <div
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginBottom: 8,
              }}
            >
              Budget
            </div>
            <div style={{ position: "relative" }}>
              <span
                className="mono"
                style={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-dim)",
                  fontSize: 18,
                }}
              >
                $
              </span>
              <input
                type="text"
                value={budget.toLocaleString("en-US")}
                onChange={(e) =>
                  setBudget(
                    parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0
                  )
                }
                className="serif"
                style={{
                  width: "100%",
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  color: "var(--text)",
                  fontSize: 28,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  padding: "16px 16px 16px 38px",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {PRESETS.map((p) => {
                const active = budget === p;
                return (
                  <button
                    key={p}
                    onClick={() => setBudget(p)}
                    className="mono"
                    style={{
                      padding: "8px 14px",
                      border: `1px solid ${
                        active ? "var(--accent)" : "var(--line-2)"
                      }`,
                      background: active ? "var(--accent-soft)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text-dim)",
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    ${p.toLocaleString()}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: 16,
                border: "1px solid var(--danger)",
                background: "color-mix(in oklab, var(--danger) 10%, transparent)",
                padding: "12px 16px",
                color: "var(--danger)",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={generate}
            disabled={budget <= 0}
            className="mono"
            style={{
              width: "100%",
              marginTop: 20,
              padding: "18px 24px",
              background: budget > 0 ? "var(--accent)" : "var(--surface-2)",
              color: budget > 0 ? "var(--bg)" : "var(--text-dim)",
              border: `1px solid ${budget > 0 ? "var(--accent)" : "var(--line)"}`,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
              cursor: budget > 0 ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <Icons.brain />
            Generate 3 Strategies
            <Icons.arrow />
          </button>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              lineHeight: 1.5,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            Runs Conservative · Balanced · Aggressive with full deep analysis.
            May take 10–30 minutes.
          </p>
        </div>
      )}

      {loading && (
        <div
          className="brackets"
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "60px 32px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {[0, 200, 400].map((d) => (
              <span
                key={d}
                style={{
                  width: 8,
                  height: 8,
                  background: "var(--accent)",
                  boxShadow: "0 0 10px var(--accent)",
                  animation: `blink 1.2s ease-in-out ${d}ms infinite`,
                }}
              />
            ))}
          </div>
          <div
            className="serif"
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text)",
              letterSpacing: "-0.03em",
              marginBottom: 10,
            }}
          >
            Generating 3 Strategies
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {progress}
          </div>
        </div>
      )}

      {valid.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="fadeUp">
          <ComparisonTable valid={valid} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${valid.length}, 1fr)`,
              gap: 16,
            }}
          >
            {valid.map((r, i) => (
              <StrategyColumn key={r.label} r={r} color={COLORS[i] || "var(--accent)"} />
            ))}
          </div>
          <button
            onClick={() => setResults([])}
            className="mono"
            style={{
              alignSelf: "flex-start",
              padding: "14px 24px",
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
            <Icons.refresh />
            New Comparison
          </button>
        </div>
      )}
    </div>
  );
}

function ComparisonTable({ valid }: { valid: StrategyResult[] }) {
  const rows: { label: string; values: string[] }[] = [
    {
      label: "Projected APY",
      values: valid.map((r) => `${r.strategy!.projectedApy.toFixed(2)}%`),
    },
    {
      label: "Yearly Return",
      values: valid.map((r) => fmt.money(r.strategy!.projectedYearlyReturn)),
    },
    {
      label: "Allocations",
      values: valid.map((r) => `${r.strategy!.allocations.length} pools`),
    },
    {
      label: "Pools Scanned",
      values: valid.map((r) => r.poolsScanned.toLocaleString()),
    },
    {
      label: "Deep Analyzed",
      values: valid.map((r) => `${r.protocolsDeepAnalyzed} protocols`),
    },
    {
      label: "Avg Safety",
      values: valid.map((r) => {
        const scores = r.strategy!.allocations.map((a) => a.legitimacyScore || 0);
        return scores.length > 0
          ? `${(scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(0)}/100`
          : "N/A";
      }),
    },
    {
      label: "Unique Chains",
      values: valid.map((r) =>
        new Set(r.strategy!.allocations.map((a) => a.chain)).size.toString()
      ),
    },
    {
      label: "Stablecoin %",
      values: valid.map((r) => {
        const stable = r.strategy!.allocations.filter((a) => a.stablecoin).length;
        const pct =
          (stable / Math.max(r.strategy!.allocations.length, 1)) * 100;
        return `${pct.toFixed(0)}%`;
      }),
    },
  ];
  const cols = `220px repeat(${valid.length}, 1fr)`;
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div style={{ padding: "22px 26px 0" }}>
        <Eyebrow>Key Metrics</Eyebrow>
      </div>
      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <div
          style={{
            minWidth: 600,
            display: "grid",
            gridTemplateColumns: cols,
            gap: 12,
            padding: "10px 26px",
            background: "var(--surface-2)",
            borderTop: "1px solid var(--line-2)",
            borderBottom: "1px solid var(--line-2)",
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 9,
              color: "var(--text-dim)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Metric
          </span>
          {valid.map((r, i) => (
            <span
              key={r.label}
              className="mono"
              style={{
                fontSize: 10,
                color: COLORS[i] || "var(--accent)",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                textAlign: "right",
              }}
            >
              {r.label}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              minWidth: 600,
              display: "grid",
              gridTemplateColumns: cols,
              gap: 12,
              padding: "12px 26px",
              borderBottom: "1px solid var(--line-2)",
              alignItems: "center",
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
              {row.label}
            </span>
            {row.values.map((v, i) => (
              <span
                key={i}
                className="mono tabular"
                style={{
                  fontSize: 13,
                  color: "var(--text)",
                  textAlign: "right",
                }}
              >
                {v}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyColumn({
  r,
  color,
}: {
  r: StrategyResult;
  color: string;
}) {
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 26,
      }}
    >
      <Eyebrow color={color}>{r.label}</Eyebrow>
      <div
        className="serif tabular"
        style={{
          fontSize: 44,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: color,
          lineHeight: 1,
          marginTop: 16,
        }}
      >
        {r.strategy!.projectedApy.toFixed(2)}%
      </div>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          letterSpacing: "0.08em",
          marginTop: 8,
        }}
      >
        {fmt.money(r.strategy!.projectedYearlyReturn)} / year
      </div>
      <p
        style={{
          fontSize: 12,
          color: "var(--text-dim)",
          lineHeight: 1.55,
          marginTop: 16,
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {r.strategy!.summary.slice(0, 200)}…
      </p>
      <div
        style={{
          marginTop: 18,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {r.strategy!.allocations.slice(0, 5).map((a, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              paddingBottom: 6,
              borderBottom: "1px solid var(--line-2)",
            }}
          >
            <span
              className="mono"
              style={{
                color: "var(--text-dim)",
                letterSpacing: "0.04em",
              }}
            >
              {a.protocol}{" "}
              <span style={{ color: "var(--text-muted)" }}>
                {a.symbol}
              </span>
            </span>
            <span
              className="mono tabular"
              style={{ color }}
            >
              {a.allocationPercent}%
            </span>
          </div>
        ))}
        {r.strategy!.allocations.length > 5 && (
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              letterSpacing: "0.12em",
            }}
          >
            +{r.strategy!.allocations.length - 5} more
          </span>
        )}
      </div>
    </div>
  );
}
