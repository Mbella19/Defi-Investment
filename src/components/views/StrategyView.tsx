"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { StrategyCriteria, InvestmentStrategy, StrategyAllocation } from "@/types/strategy";
import { saveStrategy } from "@/lib/storage";
import { useActiveStrategies } from "@/hooks/useActiveStrategies";
import { Eyebrow, Icons, Spark, Typewriter, fmt } from "@/components/sovereign";
import { getDepositUrl } from "@/lib/deposit-url";

type Risk = "low" | "medium" | "high";
type AssetType = "stablecoins" | "all";

type StrategyResult = {
  strategy: InvestmentStrategy;
  poolsScanned: number;
  protocolsAnalyzed: number;
  protocolsDeepAnalyzed: number;
};

const BUDGET_PRESETS = [1000, 10000, 50000, 100000, 500000];

const RISKS: Array<{ v: Risk; n: string; d: string }> = [
  { v: "low", n: "CONSERVATIVE", d: "1–4% APY. Blue-chip protocols. Stablecoin-weighted." },
  { v: "medium", n: "BALANCED", d: "4–8% APY. Mix of established and emerging." },
  { v: "high", n: "AGGRESSIVE", d: "8%+ APY. Higher reward, elevated tail risk." },
];

type ProgressFeedItem = {
  ts: number;
  stage: string;
  message: string;
  sub?: { done: number; total: number };
};

const SEQUENCE: Array<[string, string, string]> = [
  ["T+00s", "DeFiLlama scan", "10,422 pools indexed"],
  ["T+04s", "Filter by criteria", "~184 matching protocols"],
  ["T+22s", "Claude deep analysis", "Legitimacy, audits, team, TVL"],
  ["T+3m", "Safety-weighted portfolio", "Allocation + reasoning"],
  ["T+6m", "Execution plan", "Step-by-step, exportable"],
];

const DONUT_COLORS = [
  "var(--accent)",
  "oklch(0.82 0.14 170)",
  "oklch(0.78 0.14 200)",
  "oklch(0.72 0.1 150)",
  "oklch(0.78 0.14 70)",
  "oklch(0.65 0.22 25)",
];

function verdictLabel(v: StrategyAllocation["verdict"]): string {
  if (v === "high_confidence") return "HIGH CONFIDENCE";
  if (v === "moderate_confidence") return "MODERATE";
  if (v === "low_confidence") return "LOW CONFIDENCE";
  return "CAUTION";
}

function verdictKind(v: StrategyAllocation["verdict"]): "good" | "warn" | "danger" | "accent" {
  if (v === "high_confidence") return "accent";
  if (v === "moderate_confidence") return "warn";
  if (v === "low_confidence") return "warn";
  return "danger";
}

export default function StrategyPage() {
  const [stage, setStage] = useState<"input" | "thinking" | "result">("input");

  const [budget, setBudget] = useState(10000);
  const [risk, setRisk] = useState<Risk>("medium");
  const [apyMin, setApyMin] = useState(4);
  const [apyMax, setApyMax] = useState(12);
  const [asset, setAsset] = useState<AssetType>("all");

  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState("Initializing strategy pipeline…");
  const [feed, setFeed] = useState<ProgressFeedItem[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancelRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  const run = async () => {
    setStage("thinking");
    setProgress(0);
    setCurrentMessage("Initializing strategy pipeline…");
    setFeed([]);
    setElapsedMs(0);
    setError(null);
    setResult(null);
    cancelRef.current = false;

    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget,
          riskAppetite: risk,
          targetApyMin: apyMin,
          targetApyMax: apyMax,
          assetType: asset,
        } satisfies StrategyCriteria),
      });
      const start = await res.json();
      if (!res.ok || !start?.jobId) {
        throw new Error(start?.error || "Failed to start strategy job");
      }
      const jobId: string = start.jobId;

      // Poll for progress until the job resolves. Backend keeps the job in
      // memory; we just keep the bar in sync with whatever stage it's on.
      while (!cancelRef.current) {
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelRef.current) return;
        const pollRes = await fetch(`/api/strategy?id=${encodeURIComponent(jobId)}`);
        const job = await pollRes.json();
        if (!pollRes.ok) {
          throw new Error(job?.error || "Lost track of strategy job");
        }

        if (typeof job.progress === "number") setProgress(job.progress);
        if (typeof job.message === "string") setCurrentMessage(job.message);
        if (typeof job.elapsedMs === "number") setElapsedMs(job.elapsedMs);
        if (Array.isArray(job.events)) setFeed(job.events as ProgressFeedItem[]);

        if (job.status === "done" && job.result) {
          setProgress(100);
          setResult(job.result as StrategyResult);
          setStage("result");
          return;
        }
        if (job.status === "error") {
          throw new Error(job.error || "Strategy generation failed");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate strategy");
      setStage("input");
    }
  };

  const reset = () => {
    setStage("input");
    setResult(null);
    setError(null);
    setProgress(0);
    setCurrentMessage("Initializing strategy pipeline…");
    setFeed([]);
    setElapsedMs(0);
  };

  return (
    <div style={{ padding: "40px 48px 80px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 40,
          alignItems: "end",
          marginBottom: 48,
        }}
      >
        <div>
          <Eyebrow>AUTO-STRATEGIST / CLAUDE OPUS 4.6</Eyebrow>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(56px, 8vw, 92px)",
              fontWeight: 900,
              letterSpacing: "-0.055em",
              lineHeight: 0.9,
              margin: "20px 0 0",
            }}
          >
            Orchestrate
            <br />
            <em style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 400 }}>
              yield.
            </em>
          </h1>
        </div>
        <div>
          <p style={{ fontSize: 15, color: "var(--text-dim)", lineHeight: 1.6, maxWidth: 420 }}>
            Define budget, appetite, APY band. The Sovereign core returns a safety-weighted
            allocation with transparent reasoning and an executable plan.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 0,
              marginTop: 32,
              borderTop: "1px solid var(--line)",
              paddingTop: 18,
            }}
          >
            <div>
              <div className="serif" style={{ fontSize: 26, fontWeight: 900 }}>
                ~6m
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "var(--text-dim)",
                  marginTop: 2,
                }}
              >
                AVG RUNTIME
              </div>
            </div>
            <div>
              <div className="serif" style={{ fontSize: 26, fontWeight: 900 }}>
                184
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "var(--text-dim)",
                  marginTop: 2,
                }}
              >
                DEEP SCANS
              </div>
            </div>
            <div>
              <div
                className="serif"
                style={{ fontSize: 26, fontWeight: 900, color: "var(--accent)" }}
              >
                LIVE
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "var(--text-dim)",
                  marginTop: 2,
                }}
              >
                DATAFEED
              </div>
            </div>
          </div>
        </div>
      </div>

      {stage === "input" ? (
        <StrategyForm
          budget={budget}
          setBudget={setBudget}
          risk={risk}
          setRisk={setRisk}
          apyMin={apyMin}
          setApyMin={setApyMin}
          apyMax={apyMax}
          setApyMax={setApyMax}
          asset={asset}
          setAsset={setAsset}
          error={error}
          run={run}
        />
      ) : null}
      {stage === "thinking" ? (
        <ThinkingPanel
          progress={progress}
          message={currentMessage}
          feed={feed}
          elapsedMs={elapsedMs}
        />
      ) : null}
      {stage === "result" && result ? (
        <ResultPanel
          result={result}
          budget={budget}
          risk={risk}
          apyMin={apyMin}
          apyMax={apyMax}
          asset={asset}
          onReset={reset}
        />
      ) : null}
    </div>
  );
}

function StrategyForm({
  budget,
  setBudget,
  risk,
  setRisk,
  apyMin,
  setApyMin,
  apyMax,
  setApyMax,
  asset,
  setAsset,
  error,
  run,
}: {
  budget: number;
  setBudget: (v: number) => void;
  risk: Risk;
  setRisk: (v: Risk) => void;
  apyMin: number;
  setApyMin: (v: number) => void;
  apyMax: number;
  setApyMax: (v: number) => void;
  asset: AssetType;
  setAsset: (v: AssetType) => void;
  error: string | null;
  run: () => void;
}) {
  return (
    <div
      className="fadeUp"
      style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 0, border: "1px solid var(--line)" }}
    >
      <div style={{ padding: 40, borderRight: "1px solid var(--line)" }}>
        <div style={{ marginBottom: 48 }}>
          <Eyebrow>01 · BUDGET</Eyebrow>
          <div style={{ position: "relative", marginTop: 16 }}>
            <span
              className="serif"
              style={{
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 44,
                color: "var(--text-muted)",
                fontWeight: 300,
              }}
            >
              $
            </span>
            <input
              className="serif tabular"
              value={budget.toLocaleString()}
              onChange={(e) =>
                setBudget(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)
              }
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--line-2)",
                fontSize: 56,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                color: "var(--accent)",
                padding: "8px 0 8px 44px",
                width: "100%",
                outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
            {BUDGET_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setBudget(p)}
                className="mono"
                style={{
                  padding: "8px 14px",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  background: budget === p ? "var(--accent)" : "transparent",
                  color: budget === p ? "var(--bg)" : "var(--text-dim)",
                  border: `1px solid ${budget === p ? "var(--accent)" : "var(--line-2)"}`,
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
              >
                ${p >= 1000 ? `${p / 1000}K` : p}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 48 }}>
          <Eyebrow>02 · RISK APPETITE</Eyebrow>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1px",
              background: "var(--line)",
              marginTop: 16,
              border: "1px solid var(--line)",
            }}
          >
            {RISKS.map((r) => (
              <button
                key={r.v}
                type="button"
                onClick={() => setRisk(r.v)}
                style={{
                  padding: 20,
                  cursor: "pointer",
                  background: risk === r.v ? "var(--surface-3)" : "var(--surface)",
                  transition: "all 0.3s",
                  borderBottom:
                    risk === r.v ? "2px solid var(--accent)" : "2px solid transparent",
                  textAlign: "left",
                  color: "var(--text)",
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    color: risk === r.v ? "var(--accent)" : "var(--text-dim)",
                    marginBottom: 10,
                  }}
                >
                  {r.n}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>
                  {r.d}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 48 }}>
          <Eyebrow>03 · TARGET APY BAND</Eyebrow>
          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
            }}
          >
            <div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "var(--text-dim)",
                  marginBottom: 8,
                }}
              >
                MIN
              </div>
              <input
                type="number"
                value={apyMin}
                onChange={(e) => setApyMin(Number(e.target.value))}
                className="input serif tabular"
                style={{ fontSize: 32, fontWeight: 900, padding: "12px 16px" }}
              />
            </div>
            <div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "var(--text-dim)",
                  marginBottom: 8,
                }}
              >
                MAX
              </div>
              <input
                type="number"
                value={apyMax}
                onChange={(e) => setApyMax(Number(e.target.value))}
                className="input serif tabular"
                style={{ fontSize: 32, fontWeight: 900, padding: "12px 16px" }}
              />
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              height: 4,
              background: "var(--surface-3)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: `${Math.min(apyMin, 50) * 2}%`,
                right: `${100 - Math.min(apyMax, 50) * 2}%`,
                top: 0,
                bottom: 0,
                background: "var(--accent)",
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 48 }}>
          <Eyebrow>04 · ASSET MIX</Eyebrow>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            {([["stablecoins", "STABLECOINS ONLY"], ["all", "ALL ASSETS"]] as Array<[AssetType, string]>).map(
              ([v, n]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAsset(v)}
                  className="mono"
                  style={{
                    flex: 1,
                    padding: "18px 20px",
                    fontSize: 11,
                    letterSpacing: "0.15em",
                    background: asset === v ? "var(--accent)" : "transparent",
                    color: asset === v ? "var(--bg)" : "var(--text)",
                    border: `1px solid ${asset === v ? "var(--accent)" : "var(--line-2)"}`,
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                >
                  {n}
                </button>
              ),
            )}
          </div>
        </div>

        {error ? (
          <div
            style={{
              marginBottom: 24,
              padding: 16,
              border: "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
              background: "color-mix(in oklch, var(--danger) 10%, transparent)",
              color: "var(--danger)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={run}
          className="btn btn-primary"
          style={{ width: "100%", padding: 22, fontSize: 12, letterSpacing: "0.22em" }}
        >
          INITIATE SOVEREIGN CORE <Icons.arrow />
        </button>
      </div>

      <div style={{ padding: 40, background: "var(--surface-2)" }}>
        <Eyebrow>SEQUENCE</Eyebrow>
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 0 }}>
          {SEQUENCE.map(([t, n, d], i) => (
            <div
              key={t}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr",
                gap: 16,
                padding: "18px 0",
                borderBottom: i < SEQUENCE.length - 1 ? "1px dashed var(--line)" : "none",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.15em",
                  color: "var(--accent)",
                  paddingTop: 4,
                }}
              >
                {t}
              </div>
              <div>
                <div style={{ fontSize: 14, color: "var(--text)", marginBottom: 4 }}>{n}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function ThinkingPanel({
  progress,
  message,
  feed,
  elapsedMs,
}: {
  progress: number;
  message: string;
  feed: ProgressFeedItem[];
  elapsedMs: number;
}) {
  return (
    <div
      className="fadeUp"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        position: "relative",
        overflow: "hidden",
        minHeight: 600,
      }}
    >
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 2,
            background:
              "linear-gradient(to right, transparent, var(--accent), transparent)",
            animation: "scan-line 3s linear infinite",
            opacity: 0.6,
          }}
        />
      </div>

      <div
        style={{
          padding: 60,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 60,
        }}
      >
        <div>
          <Eyebrow>SOVEREIGN CORE · ANALYZING</Eyebrow>
          <h2
            className="serif"
            style={{
              fontSize: "clamp(36px, 4vw, 64px)",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              margin: "24px 0",
            }}
          >
            <Typewriter key={message} text={message} speed={14} />
          </h2>
          <div
            className="mono"
            style={{
              marginTop: 12,
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
            }}
          >
            ELAPSED · {formatElapsed(elapsedMs)}
          </div>

          <div style={{ marginTop: 40 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 10,
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--text-dim)" }}
              >
                PROGRESS
              </span>
              <span
                className="serif tabular"
                style={{
                  fontSize: 40,
                  fontWeight: 900,
                  color: "var(--accent)",
                  letterSpacing: "-0.03em",
                }}
              >
                {Math.floor(progress)}%
              </span>
            </div>
            <div
              style={{
                height: 3,
                background: "var(--surface-3)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${progress}%`,
                  background: "var(--accent)",
                  transition: "width 0.3s",
                  boxShadow: "0 0 16px var(--accent)",
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 40 }}>
            <Eyebrow>LIVE FEED · BACKEND EVENTS</Eyebrow>
            <div
              className="mono"
              style={{
                marginTop: 16,
                fontSize: 11,
                color: "var(--text-dim)",
                lineHeight: 1.7,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {feed.length === 0 ? (
                <div style={{ opacity: 0.6 }}>
                  <span style={{ color: "var(--accent)" }}>▸</span> Waiting for first event…
                </div>
              ) : (
                feed.slice().reverse().map((e, i) => {
                  const sub =
                    e.sub && e.sub.total > 0
                      ? ` (${e.sub.done}/${e.sub.total})`
                      : "";
                  return (
                    <div
                      key={`${e.ts}-${i}`}
                      style={{ opacity: i === 0 ? 1 : Math.max(0.35, 1 - i * 0.12) }}
                    >
                      <span style={{ color: "var(--accent)" }}>▸</span>{" "}
                      <span style={{ color: "var(--text-2)" }}>
                        [{e.stage}]
                      </span>{" "}
                      {e.message}
                      {sub}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 320, height: 320, position: "relative" }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: `${i * 30}px`,
                  border: "1px solid var(--line-2)",
                  borderRadius: "50%",
                  animation: `orbit ${20 + i * 8}s linear infinite ${i % 2 ? "reverse" : ""}`,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -4,
                    left: "50%",
                    width: 8,
                    height: 8,
                    background: "var(--accent)",
                    borderRadius: "50%",
                    transform: `translateX(-50%) rotate(${i * 45}deg)`,
                    boxShadow: "0 0 12px var(--accent)",
                  }}
                />
              </div>
            ))}
            <div
              style={{
                position: "absolute",
                inset: 120,
                background:
                  "radial-gradient(circle, var(--accent-soft), transparent 70%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                className="serif tabular"
                style={{
                  fontSize: 48,
                  fontWeight: 900,
                  color: "var(--accent)",
                  letterSpacing: "-0.04em",
                }}
              >
                {Math.floor(progress)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  budget,
  risk,
  apyMin,
  apyMax,
  asset,
  onReset,
}: {
  result: StrategyResult;
  budget: number;
  risk: Risk;
  apyMin: number;
  apyMax: number;
  asset: AssetType;
  onReset: () => void;
}) {
  const { strategy } = result;
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const { activateStrategy } = useActiveStrategies();

  const projectedReturn = strategy.projectedYearlyReturn ?? budget * (strategy.projectedApy / 100);

  return (
    <div className="fadeUp">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "1px",
          background: "var(--line)",
          border: "1px solid var(--line)",
          marginBottom: 32,
        }}
      >
        {(
          [
            [result.poolsScanned.toLocaleString(), "POOLS SCANNED", false],
            [String(result.protocolsAnalyzed), "PROTOCOLS FILTERED", false],
            [String(result.protocolsDeepAnalyzed), "DEEP ANALYZED", false],
            [`${strategy.projectedApy.toFixed(2)}%`, "PROJECTED APY", true],
            [fmt.dollar(projectedReturn), "YEAR RETURN", true],
          ] as Array<[string, string, boolean]>
        ).map(([v, l, accent]) => (
          <div key={l} style={{ background: "var(--surface)", padding: 28 }}>
            <div
              className="serif tabular"
              style={{
                fontSize: "clamp(28px, 3vw, 42px)",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                color: accent ? "var(--accent)" : "var(--text)",
              }}
            >
              {v}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.2em",
                color: "var(--text-dim)",
                marginTop: 6,
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 24,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: 40,
          }}
        >
          <Eyebrow>AI REASONING</Eyebrow>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.65,
              color: "var(--text)",
              marginTop: 20,
              maxWidth: 720,
              whiteSpace: "pre-line",
            }}
          >
            {strategy.summary}
          </p>
          {strategy.riskAssessment ? (
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.65,
                color: "var(--text-dim)",
                marginTop: 20,
                whiteSpace: "pre-line",
              }}
            >
              {strategy.riskAssessment}
            </p>
          ) : null}
          <div
            style={{
              marginTop: 32,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 24,
              borderTop: "1px dashed var(--line)",
              paddingTop: 24,
            }}
          >
            <div>
              <div
                className="mono"
                style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-dim)" }}
              >
                DIVERSIFICATION
              </div>
              <div className="serif" style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
                {strategy.allocations.length >= 4
                  ? "Excellent"
                  : strategy.allocations.length >= 2
                    ? "Adequate"
                    : "Thin"}
              </div>
            </div>
            <div>
              <div
                className="mono"
                style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-dim)" }}
              >
                APY BAND
              </div>
              <div
                className="serif tabular"
                style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}
              >
                {apyMin}–{apyMax}%
              </div>
            </div>
            <div>
              <div
                className="mono"
                style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-dim)" }}
              >
                ASSET MIX
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  marginTop: 6,
                  color: "var(--accent)",
                }}
              >
                {asset === "stablecoins" ? "Stables" : "All"}
              </div>
            </div>
          </div>
        </div>

        <AllocationDonut allocations={strategy.allocations} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            marginBottom: 20,
          }}
        >
          <div>
            <Eyebrow>
              ALLOCATIONS / {String(strategy.allocations.length).padStart(2, "0")}
            </Eyebrow>
            <h3
              className="serif"
              style={{
                fontSize: 40,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                marginTop: 12,
              }}
            >
              Portfolio ledger
            </h3>
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
            SAFETY-WEIGHTED · SORT: DESCENDING
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            background: "var(--line)",
            border: "1px solid var(--line)",
          }}
        >
          {strategy.allocations.map((a, i) => (
            <AllocRow key={`${a.protocol}-${i}`} alloc={a} index={i + 1} />
          ))}
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: 40,
          marginBottom: 32,
        }}
      >
        <Eyebrow>EXECUTION PLAN</Eyebrow>
        <h3
          className="serif"
          style={{
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            margin: "12px 0 32px",
          }}
        >
          {strategy.steps.length} steps to activation
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "1px 40px",
          }}
        >
          {strategy.steps.map((s, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr",
                gap: 16,
                padding: "16px 0",
                borderBottom:
                  i < strategy.steps.length - 2 ? "1px dashed var(--line)" : "none",
              }}
            >
              <div
                className="mono"
                style={{ fontSize: 11, color: "var(--accent)", paddingTop: 2 }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55 }}>
                {s}
              </div>
            </div>
          ))}
        </div>
      </div>

      {strategy.warnings.length > 0 ? (
        <div
          style={{
            border: "1px solid color-mix(in oklch, var(--warn) 30%, transparent)",
            background: "color-mix(in oklch, var(--warn) 8%, transparent)",
            padding: 32,
            marginBottom: 32,
          }}
        >
          <Eyebrow>WARNINGS</Eyebrow>
          <ul
            style={{
              marginTop: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              listStyle: "none",
              padding: 0,
            }}
          >
            {strategy.warnings.map((w, i) => (
              <li
                key={i}
                style={{
                  fontSize: 13,
                  color: "var(--text-dim)",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <span style={{ color: "var(--warn)", marginTop: 2 }}>⚠</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={onReset}>
          NEW STRATEGY
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            saveStrategy({
              ...strategy,
              criteria: {
                budget,
                riskAppetite: risk,
              },
            });
          }}
        >
          SAVE TO VAULT
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={activating || activated}
          onClick={async () => {
            setActivating(true);
            try {
              await activateStrategy(strategy, {
                budget,
                riskAppetite: risk,
                targetApyMin: apyMin,
                targetApyMax: apyMax,
                assetType: asset,
              });
              setActivated(true);
            } catch {
              setActivating(false);
            }
          }}
        >
          {activated ? "MONITORING ACTIVE" : activating ? "ACTIVATING…" : "ACTIVATE & MONITOR"}{" "}
          <Icons.arrow />
        </button>
      </div>
    </div>
  );
}

function AllocationDonut({ allocations }: { allocations: StrategyAllocation[] }) {
  const R = 90;
  const C = 2 * Math.PI * R;
  let cum = 0;

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 40,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Eyebrow>ALLOCATION</Eyebrow>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32,
          marginTop: 24,
          flex: 1,
          flexWrap: "wrap",
        }}
      >
        <svg viewBox="-110 -110 220 220" width="220" height="220">
          <circle r={R} fill="none" stroke="var(--surface-3)" strokeWidth="18" />
          {allocations.map((a, i) => {
            const pct = a.allocationPercent ?? 0;
            const len = (pct / 100) * C;
            const dash = `${len} ${C - len}`;
            const offset = (-cum / 100) * C;
            cum += pct;
            return (
              <circle
                key={`${a.protocol}-${i}`}
                r={R}
                fill="none"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                strokeWidth="18"
                strokeDasharray={dash}
                strokeDashoffset={offset}
                transform="rotate(-90)"
                style={{ transition: "all 1s" }}
              />
            );
          })}
          <text
            x="0"
            y="-4"
            textAnchor="middle"
            fontFamily="Fraunces"
            fontSize="36"
            fontWeight="900"
            fill="var(--text)"
            letterSpacing="-1"
          >
            100%
          </text>
          <text
            x="0"
            y="22"
            textAnchor="middle"
            fontFamily="Geist Mono"
            fontSize="10"
            fill="var(--text-dim)"
            letterSpacing="3"
          >
            ALLOCATED
          </text>
        </svg>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
          {allocations.map((a, i) => (
            <div
              key={`${a.protocol}-${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: "12px 1fr auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  background: DONUT_COLORS[i % DONUT_COLORS.length],
                }}
              />
              <div style={{ fontSize: 12, color: "var(--text)" }}>{a.protocol}</div>
              <div
                className="mono tabular"
                style={{ fontSize: 11, color: "var(--text-dim)" }}
              >
                {a.allocationPercent}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AllocRow({ alloc, index }: { alloc: StrategyAllocation; index: number }) {
  const [open, setOpen] = useState(false);
  const sparkData = Array.from(
    { length: 30 },
    (_, i) => alloc.apy + Math.sin(i * 0.4 + index) * 0.8 + Math.cos(i * 0.25) * 0.4,
  );
  const safetyColor =
    alloc.legitimacyScore >= 85
      ? "var(--good)"
      : alloc.legitimacyScore >= 70
        ? "var(--warn)"
        : "var(--danger)";
  const kind = verdictKind(alloc.verdict);

  return (
    <div style={{ background: "var(--surface)", padding: "24px 32px" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "grid",
          gridTemplateColumns: "40px 1.2fr 1fr 0.8fr 0.9fr 0.9fr 100px",
          gap: 20,
          alignItems: "center",
          width: "100%",
          cursor: "pointer",
          background: "transparent",
          border: "none",
          color: "var(--text)",
          padding: 0,
          textAlign: "left",
        }}
      >
        <div
          className="serif tabular"
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: "var(--text-muted)",
            letterSpacing: "-0.04em",
          }}
        >
          {String(index).padStart(2, "0")}
        </div>
        <div>
          <div
            className="serif"
            style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}
          >
            {alloc.protocol}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.15em",
              color: "var(--text-dim)",
              marginTop: 4,
            }}
          >
            {alloc.symbol} · {alloc.chain}
          </div>
        </div>
        <div>
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.2em",
              color: "var(--text-dim)",
              marginBottom: 4,
            }}
          >
            SAFETY
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              className="serif tabular"
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: safetyColor,
              }}
            >
              {alloc.legitimacyScore}
            </div>
            <div
              style={{
                flex: 1,
                height: 4,
                background: "var(--surface-3)",
                maxWidth: 80,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(0, Math.min(100, alloc.legitimacyScore))}%`,
                  background: safetyColor,
                }}
              />
            </div>
          </div>
        </div>
        <div>
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.2em",
              color: "var(--text-dim)",
              marginBottom: 4,
            }}
          >
            APY
          </div>
          <div
            className="serif tabular"
            style={{ fontSize: 24, fontWeight: 900, color: "var(--accent)" }}
          >
            {alloc.apy.toFixed(2)}%
          </div>
        </div>
        <div>
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.2em",
              color: "var(--text-dim)",
              marginBottom: 4,
            }}
          >
            7D TREND
          </div>
          <Spark data={sparkData} color="var(--accent)" height={28} />
        </div>
        <div>
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.2em",
              color: "var(--text-dim)",
              marginBottom: 4,
            }}
          >
            ALLOCATE
          </div>
          <div
            className="serif tabular"
            style={{ fontSize: 24, fontWeight: 900 }}
          >
            {fmt.dollar(alloc.allocationAmount)}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>
            {alloc.allocationPercent}% of book
          </div>
        </div>
        <span
          className="btn"
          style={{ padding: "10px 14px", justifyContent: "center", pointerEvents: "none" }}
        >
          {open ? "CLOSE" : "OPEN"} <Icons.arrow />
        </span>
      </button>
      {open ? (
        <div
          style={{
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1px dashed var(--line)",
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 40,
          }}
        >
          <div>
            <Eyebrow>REASONING</Eyebrow>
            <p
              style={{
                fontSize: 14,
                color: "var(--text)",
                lineHeight: 1.65,
                marginTop: 12,
              }}
            >
              {alloc.reasoning}
            </p>
            {alloc.redFlags && alloc.redFlags.length > 0 ? (
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {alloc.redFlags.map((f) => (
                  <span key={f} className="chip warn">
                    ⚠ {f}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <Eyebrow>VERDICT</Eyebrow>
            <div
              className={`chip ${kind}`}
              style={{ marginTop: 12, fontSize: 11, padding: "8px 14px" }}
            >
              {verdictLabel(alloc.verdict)}
            </div>
            <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn" href={`/protocol/${alloc.protocol}`}>
                RESEARCH <Icons.arrow />
              </Link>
              <a
                className="btn btn-primary"
                href={getDepositUrl(alloc.protocol, alloc.poolId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                INVEST <Icons.arrow />
              </a>
              <a
                className="btn"
                href={`https://defillama.com/yields/pool/${alloc.poolId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                POOL <Icons.arrow />
              </a>
              {alloc.contractAddress ? (
                <Link
                  className="btn"
                  href={`/security/audit?address=${alloc.contractAddress}&chain=${encodeURIComponent(alloc.auditChain ?? alloc.chain)}&autostart=1`}
                  title="Run multi-engine audit (Slither + Aderyn + Mythril + on-chain) reconciled by triple-AI panel"
                >
                  AUDIT <Icons.arrow />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
