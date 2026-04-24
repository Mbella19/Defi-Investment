"use client";

import { Fragment, useState, useEffect, useMemo } from "react";
import { loadStrategies } from "@/lib/storage";
import { fmt, Eyebrow, Icons } from "@/components/sovereign";
import type { InvestmentStrategy } from "@/types/strategy";
import type { RiskAnalysisResult } from "@/types/risk-models";

export default function RiskPage() {
  const [strategies, setStrategies] = useState<InvestmentStrategy[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStrategies(loadStrategies());
  }, []);

  const runAnalysis = async () => {
    if (selectedIdx < 0) return;
    const strategy = strategies[selectedIdx];
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations: strategy.allocations.map((a) => ({
            poolId: a.poolId,
            symbol: a.symbol,
            protocol: a.protocol,
            allocationAmount: a.allocationAmount,
            allocationPercent: a.allocationPercent,
            stablecoin: a.stablecoin,
            chain: a.chain,
          })),
          portfolioValue: strategy.allocations.reduce(
            (s, a) => s + a.allocationAmount,
            0
          ),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Risk analysis failed");
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run analysis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px 48px 96px", maxWidth: 1440, margin: "0 auto" }}>
      <section style={{ marginBottom: 40 }}>
        <Eyebrow color="var(--danger)">Quantitative Risk Analysis / R.LAB</Eyebrow>
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
          Risk
          <br />
          <span
            style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 300 }}
          >
            Laboratory.
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
          Institutional-grade risk modeling. Value at Risk, correlation analysis, stress
          testing, Sharpe and Sortino ratios, and maximum drawdown calculations on your
          saved strategies.
        </p>
      </section>

      {!result && (
        <StrategyPicker
          strategies={strategies}
          selectedIdx={selectedIdx}
          setSelectedIdx={setSelectedIdx}
          loading={loading}
          error={error}
          runAnalysis={runAnalysis}
        />
      )}

      {result && (
        <RiskReport
          result={result}
          strategy={strategies[selectedIdx]}
          onReset={() => {
            setResult(null);
            setSelectedIdx(-1);
          }}
        />
      )}
    </div>
  );
}

function StrategyPicker({
  strategies,
  selectedIdx,
  setSelectedIdx,
  loading,
  error,
  runAnalysis,
}: {
  strategies: InvestmentStrategy[];
  selectedIdx: number;
  setSelectedIdx: (n: number) => void;
  loading: boolean;
  error: string | null;
  runAnalysis: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr",
        gap: 24,
        alignItems: "start",
      }}
    >
      <div
        className="brackets"
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: 28,
        }}
      >
        <Eyebrow>Select a Saved Strategy</Eyebrow>
        <div style={{ marginTop: 18 }}>
          {strategies.length === 0 ? (
            <div
              style={{
                border: "1px dashed var(--line-2)",
                padding: "32px 20px",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
                No saved strategies found. Generate a strategy on the{" "}
                <a
                  href="/discover"
                  style={{
                    color: "var(--accent)",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  AI Strategist
                </a>{" "}
                page first.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {strategies.map((s, i) => {
                const active = selectedIdx === i;
                const totalAmount = s.allocations.reduce(
                  (sum, a) => sum + a.allocationAmount,
                  0
                );
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedIdx(i)}
                    style={{
                      textAlign: "left",
                      padding: "18px 20px",
                      background: active ? "var(--surface-2)" : "transparent",
                      border: `1px solid ${
                        active ? "var(--accent)" : "var(--line-2)"
                      }`,
                      borderLeft: `3px solid ${
                        active ? "var(--accent)" : "var(--line-2)"
                      }`,
                      cursor: "pointer",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: active ? "var(--accent)" : "var(--text)",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}
                      >
                        {s.allocations.length} allocations · {s.projectedApy.toFixed(2)}% APY
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-dim)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {new Date(s.generatedAt).toLocaleDateString()} ·{" "}
                        {fmt.money(totalAmount)} deployed
                      </div>
                    </div>
                    <div
                      className="serif"
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        letterSpacing: "-0.03em",
                        color: "var(--accent)",
                      }}
                    >
                      {fmt.money(s.projectedYearlyReturn)}
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          color: "var(--text-dim)",
                          letterSpacing: "0.12em",
                          marginLeft: 4,
                        }}
                      >
                        /YR
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              marginTop: 20,
              border: "1px solid var(--danger)",
              background:
                "color-mix(in oklab, var(--danger) 10%, transparent)",
              padding: "12px 16px",
              color: "var(--danger)",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={runAnalysis}
          disabled={loading || selectedIdx < 0}
          className="mono"
          style={{
            width: "100%",
            marginTop: 20,
            padding: "18px 24px",
            background:
              loading || selectedIdx < 0 ? "var(--surface-2)" : "var(--accent)",
            color:
              loading || selectedIdx < 0 ? "var(--text-dim)" : "var(--bg)",
            border: `1px solid ${
              loading || selectedIdx < 0 ? "var(--line)" : "var(--accent)"
            }`,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 600,
            cursor:
              loading || selectedIdx < 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  width: 6,
                  height: 6,
                  background: "var(--accent)",
                  boxShadow: "0 0 8px var(--accent)",
                  animation: "blink 1s ease-in-out infinite",
                }}
              />
              Computing historical models…
            </>
          ) : (
            <>
              <Icons.brain />
              Run Risk Analysis
              <Icons.arrow />
            </>
          )}
        </button>
      </div>

      <aside
        className="brackets"
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <Eyebrow>Models Executed</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            {
              k: "VaR",
              title: "Value at Risk",
              body: "Historical simulation at 95% and 99% confidence intervals across 1-year windows.",
            },
            {
              k: "σ",
              title: "Sharpe / Sortino",
              body: "Excess return per unit of volatility, separating downside from total risk.",
            },
            {
              k: "ρ",
              title: "Correlation Matrix",
              body: "Pairwise APY correlation to quantify diversification benefit across positions.",
            },
            {
              k: "⚠",
              title: "Stress Scenarios",
              body: "Projected loss under Luna, FTX, USDC depeg, and Q4 '22 liquidity freeze regimes.",
            },
            {
              k: "↓",
              title: "Max Drawdown",
              body: "Peak-to-trough decline for each yield source over available history.",
            },
          ].map((m) => (
            <div
              key={m.k}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr",
                gap: 14,
                padding: "12px 14px",
                border: "1px solid var(--line-2)",
                background: "var(--surface-2)",
              }}
            >
              <div
                className="mono"
                style={{
                  width: 36,
                  height: 36,
                  border: "1px solid var(--accent)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                {m.k}
              </div>
              <div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--text)",
                    marginBottom: 4,
                  }}
                >
                  {m.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    lineHeight: 1.5,
                  }}
                >
                  {m.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function RiskReport({
  result,
  strategy,
  onReset,
}: {
  result: RiskAnalysisResult;
  strategy: InvestmentStrategy | undefined;
  onReset: () => void;
}) {
  const sharpeColor =
    result.sharpe.interpretation === "excellent" ||
    result.sharpe.interpretation === "good"
      ? "var(--good)"
      : result.sharpe.interpretation === "adequate"
      ? "var(--warn)"
      : "var(--danger)";

  const maxDD = useMemo(() => {
    if (result.drawdowns.length === 0) return 0;
    return Math.max(...result.drawdowns.map((d) => d.drawdown.maxDrawdown));
  }, [result.drawdowns]);

  const worstStress = useMemo(() => {
    if (result.stressTests.length === 0) return null;
    return [...result.stressTests].sort(
      (a, b) => b.projectedLossPercent - a.projectedLossPercent
    )[0];
  }, [result.stressTests]);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
      className="fadeUp"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: "var(--line)",
          border: "1px solid var(--line)",
        }}
      >
        <MetricCell
          label="VaR 95%"
          value={fmt.money(result.var.value95)}
          hint={`${result.var.timeHorizon}d horizon`}
          color="var(--danger)"
        />
        <MetricCell
          label="VaR 99%"
          value={fmt.money(result.var.value99)}
          hint="Worst-case tail"
          color="var(--danger)"
        />
        <MetricCell
          label="Sharpe"
          value={result.sharpe.ratio.toFixed(2)}
          hint={`${result.sharpe.interpretation} · vol ${result.sharpe.volatility.toFixed(1)}%`}
          color={sharpeColor}
        />
        <MetricCell
          label="Max Drawdown"
          value={`-${maxDD.toFixed(1)}%`}
          hint={
            worstStress ? `${worstStress.name}: ${worstStress.projectedLossPercent.toFixed(1)}%` : "—"
          }
          color="var(--warn)"
        />
      </div>

      {strategy && (
        <div
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "18px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginBottom: 4,
              }}
            >
              Subject Strategy
            </div>
            <div
              className="serif"
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "var(--text)",
                letterSpacing: "-0.02em",
              }}
            >
              {strategy.allocations.length} allocations ·{" "}
              {strategy.projectedApy.toFixed(2)}% projected APY
            </div>
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              letterSpacing: "0.06em",
            }}
          >
            {fmt.money(result.var.portfolioValue)} analyzed
          </div>
        </div>
      )}

      <StressBars stressTests={result.stressTests} />
      <CorrelationHeatmap correlations={result.correlations} />
      <DrawdownLedger drawdowns={result.drawdowns} />

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={onReset}
          className="mono"
          style={{
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
          New Analysis
        </button>
      </div>
    </div>
  );
}

function MetricCell({
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
    <div style={{ background: "var(--surface)", padding: "24px 22px" }}>
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
          fontSize: 36,
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
            marginTop: 10,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function StressBars({
  stressTests,
}: {
  stressTests: RiskAnalysisResult["stressTests"];
}) {
  if (stressTests.length === 0) return null;
  const max = Math.max(...stressTests.map((t) => t.projectedLossPercent));
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 28,
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
        <Eyebrow color="var(--danger)">Stress Test Scenarios</Eyebrow>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Historical Crisis Regimes
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {stressTests.map((t) => {
          const w = (t.projectedLossPercent / max) * 100;
          return (
            <div key={t.name}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 6,
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--text)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {t.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-dim)",
                      marginLeft: 12,
                    }}
                  >
                    {t.description}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 14,
                    flexShrink: 0,
                  }}
                >
                  <span
                    className="mono tabular"
                    style={{ fontSize: 11, color: "var(--danger)" }}
                  >
                    -{fmt.money(t.projectedLoss)}
                  </span>
                  <span
                    className="mono tabular"
                    style={{
                      fontSize: 13,
                      color: "var(--danger)",
                      minWidth: 56,
                      textAlign: "right",
                    }}
                  >
                    -{t.projectedLossPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div
                style={{
                  position: "relative",
                  height: 8,
                  background: "var(--surface-2)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${w}%`,
                    background:
                      "linear-gradient(90deg, var(--danger), color-mix(in oklab, var(--danger) 50%, transparent))",
                    boxShadow: "0 0 10px color-mix(in oklab, var(--danger) 60%, transparent)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CorrelationHeatmap({
  correlations,
}: {
  correlations: RiskAnalysisResult["correlations"];
}) {
  if (correlations.length === 0) return null;
  const symbols = Array.from(
    new Set(correlations.flatMap((c) => [c.symbolA, c.symbolB]))
  );
  const matrix: Record<string, Record<string, number>> = {};
  for (const s of symbols) matrix[s] = { [s]: 1 };
  for (const c of correlations) {
    matrix[c.symbolA] ||= {};
    matrix[c.symbolB] ||= {};
    matrix[c.symbolA][c.symbolB] = c.correlation;
    matrix[c.symbolB][c.symbolA] = c.correlation;
  }
  const colorFor = (v: number) => {
    if (v >= 0.7) return "var(--danger)";
    if (v >= 0.4) return "var(--warn)";
    if (v >= 0) return "var(--accent)";
    return "var(--good)";
  };
  const cell = 56;
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 28,
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
        <Eyebrow>APY Correlation Heatmap</Eyebrow>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          -1 divergent · +1 lockstep
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `72px repeat(${symbols.length}, ${cell}px)`,
            gap: 2,
            minWidth: 72 + symbols.length * (cell + 2),
          }}
        >
          <div />
          {symbols.map((s) => (
            <div
              key={`h-${s}`}
              className="mono"
              style={{
                fontSize: 9,
                color: "var(--text-dim)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                textAlign: "center",
                alignSelf: "end",
                paddingBottom: 6,
              }}
            >
              {s}
            </div>
          ))}
          {symbols.map((row) => (
            <Fragment key={`row-${row}`}>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  color: "var(--text-dim)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: 10,
                  height: cell,
                }}
              >
                {row}
              </div>
              {symbols.map((col) => {
                const v = matrix[row]?.[col];
                if (v === undefined) {
                  return (
                    <div
                      key={`${row}-${col}`}
                      style={{
                        width: cell,
                        height: cell,
                        background: "var(--surface-2)",
                        border: "1px solid var(--line)",
                      }}
                    />
                  );
                }
                const intensity = Math.min(1, Math.abs(v));
                const c = colorFor(v);
                return (
                  <div
                    key={`${row}-${col}`}
                    title={`${row} × ${col}: ${v.toFixed(3)}`}
                    style={{
                      width: cell,
                      height: cell,
                      background: `color-mix(in oklab, ${c} ${
                        intensity * 55
                      }%, var(--surface-2))`,
                      border: `1px solid ${
                        row === col ? "var(--accent)" : "var(--line-2)"
                      }`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: "var(--text)",
                    }}
                    className="mono tabular"
                  >
                    {v.toFixed(2)}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function DrawdownLedger({
  drawdowns,
}: {
  drawdowns: RiskAnalysisResult["drawdowns"];
}) {
  if (drawdowns.length === 0) return null;
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div style={{ padding: "22px 26px 0" }}>
        <Eyebrow>Maximum Drawdown Per Pool</Eyebrow>
      </div>
      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <div
          style={{
            minWidth: 780,
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1.4fr",
            gap: 10,
            padding: "10px 26px",
            background: "var(--surface-2)",
            borderTop: "1px solid var(--line-2)",
            borderBottom: "1px solid var(--line-2)",
          }}
        >
          {["Pool", "Max Drawdown", "Peak APY", "Trough APY", "Period"].map((h, i) => (
            <span
              key={h}
              className="mono"
              style={{
                fontSize: 9,
                color: "var(--text-dim)",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                textAlign: i === 0 || i === 4 ? "left" : "right",
              }}
            >
              {h}
            </span>
          ))}
        </div>
        {drawdowns.map((d) => (
          <div
            key={d.poolId}
            style={{
              minWidth: 780,
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1.4fr",
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
                letterSpacing: "0.06em",
              }}
            >
              {d.symbol}
            </span>
            <span
              className="mono tabular"
              style={{
                fontSize: 13,
                color: "var(--danger)",
                textAlign: "right",
              }}
            >
              -{d.drawdown.maxDrawdown.toFixed(1)}%
            </span>
            <span
              className="mono tabular"
              style={{
                fontSize: 12,
                color: "var(--good)",
                textAlign: "right",
              }}
            >
              {d.drawdown.peakApy.toFixed(2)}%
            </span>
            <span
              className="mono tabular"
              style={{
                fontSize: 12,
                color: "var(--danger)",
                textAlign: "right",
              }}
            >
              {d.drawdown.troughApy.toFixed(2)}%
            </span>
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--text-dim)",
                letterSpacing: "0.06em",
              }}
            >
              {d.drawdown.peakDate
                ? new Date(d.drawdown.peakDate).toLocaleDateString()
                : "N/A"}{" "}
              →{" "}
              {d.drawdown.troughDate
                ? new Date(d.drawdown.troughDate).toLocaleDateString()
                : "N/A"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
