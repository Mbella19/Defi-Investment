"use client";

import { useEffect, useRef, useState } from "react";
import { Icons } from "./Icons";
import type { InvestmentStrategy, StrategyCriteria } from "@/types/strategy";

type Props = {
  open: boolean;
  onClose: () => void;
  initialBudget?: number;
  initialRisk?: "Safe" | "Balanced" | "Degen";
};

type ProgressEvent = {
  ts: number;
  stage: string;
  message: string;
  sub?: { done: number; total: number };
};

type ProgressState = {
  percent: number;
  stage: string;
  message: string;
  sub?: { done: number; total: number };
  elapsedMs: number;
  events: ProgressEvent[];
};

const INITIAL_PROGRESS: ProgressState = {
  percent: 0,
  stage: "starting",
  message: "Initializing strategy pipeline…",
  elapsedMs: 0,
  events: [],
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
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setBudget(initialBudget);
    setRisk(initialRisk);
    setResult(null);
    setError(null);
    setProgress(INITIAL_PROGRESS);
  }, [open, initialBudget, initialRisk]);

  useEffect(() => {
    if (!open) {
      cancelRef.current = true;
    }
    return () => {
      cancelRef.current = true;
    };
  }, [open]);

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
    setProgress(INITIAL_PROGRESS);
    cancelRef.current = false;

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
      const start = await res.json();
      if (!res.ok || !start?.jobId) {
        throw new Error(start?.error ?? "Failed to start strategy job");
      }
      const jobId: string = start.jobId;

      // Poll backend job until it resolves. Backend keeps the job in-memory
      // and we just mirror its current stage/message into the UI state.
      while (!cancelRef.current) {
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelRef.current) return;
        const pollRes = await fetch(`/api/strategy?id=${encodeURIComponent(jobId)}`);
        const job = await pollRes.json();
        if (!pollRes.ok) {
          throw new Error(job?.error || "Lost track of strategy job");
        }

        setProgress({
          percent: typeof job.progress === "number" ? job.progress : 0,
          stage: typeof job.stage === "string" ? job.stage : "running",
          message: typeof job.message === "string" ? job.message : "Working…",
          sub: job.sub,
          elapsedMs: typeof job.elapsedMs === "number" ? job.elapsedMs : 0,
          events: Array.isArray(job.events) ? (job.events as ProgressEvent[]) : [],
        });

        if (job.status === "done" && job.result?.strategy) {
          setProgress((p) => ({ ...p, percent: 100 }));
          setResult(job.result.strategy as InvestmentStrategy);
          return;
        }
        if (job.status === "error") {
          throw new Error(job.error || "Strategy generation failed");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Strategy request failed");
    } finally {
      setLoading(false);
    }
  }

  function formatElapsed(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return "0s";
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
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
              Live DeFiLlama pools · Claude proposes, GPT-5.5 + Gemini review in parallel, Claude revises
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

        {!result && !loading ? (
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
        ) : result ? (
          <StrategyResultView result={result} />
        ) : null}

        {loading && !result ? (
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--surface-2)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
            aria-live="polite"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                }}
              >
                {progress.stage.replace(/_/g, " ")} · {formatElapsed(progress.elapsedMs)}
              </div>
              <div
                className="mono tabular"
                style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}
              >
                {Math.floor(progress.percent)}%
              </div>
            </div>
            <div
              style={{
                height: 4,
                background: "var(--surface-3)",
                borderRadius: 999,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${Math.max(2, progress.percent)}%`,
                  background: "var(--accent)",
                  transition: "width 0.4s ease-out",
                }}
              />
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.5 }}>
              {progress.message}
              {progress.sub && progress.sub.total > 0
                ? ` (${progress.sub.done}/${progress.sub.total})`
                : ""}
            </div>
            <div
              className="mono"
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "var(--text-dim)",
                lineHeight: 1.7,
                maxHeight: 140,
                overflowY: "auto",
                borderTop: "1px solid var(--line)",
                paddingTop: 10,
              }}
            >
              {progress.events.length === 0 ? (
                <div style={{ opacity: 0.6 }}>
                  <span style={{ color: "var(--accent)" }}>▸</span> Waiting for first backend event…
                </div>
              ) : (
                progress.events
                  .slice()
                  .reverse()
                  .map((e, i) => {
                    const sub =
                      e.sub && e.sub.total > 0 ? ` (${e.sub.done}/${e.sub.total})` : "";
                    return (
                      <div
                        key={`${e.ts}-${i}`}
                        style={{
                          opacity: i === 0 ? 1 : Math.max(0.4, 1 - i * 0.12),
                        }}
                      >
                        <span style={{ color: "var(--accent)" }}>▸</span>{" "}
                        <span style={{ color: "var(--text-2)" }}>[{e.stage}]</span>{" "}
                        {e.message}
                        {sub}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        ) : null}

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
                  {loading
                    ? `${Math.floor(progress.percent)}% · ${progress.stage.replace(/_/g, " ")}`
                    : "Generate strategy"}{" "}
                  {!loading ? <Icons.arrow size={13} /> : null}
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
  const verdicts = c.reviewerVerdicts ?? { codex: c.codexVerdict, gemini: "unavailable" as const };
  const codexAvailable = verdicts.codex !== "unavailable";
  const geminiAvailable = verdicts.gemini !== "unavailable";
  const availableCount = (codexAvailable ? 1 : 0) + (geminiAvailable ? 1 : 0);
  const allApproved =
    codexAvailable && geminiAvailable &&
    verdicts.codex === "approve" &&
    verdicts.gemini === "approve" &&
    total === 0;

  let label: string;
  let tone: "good" | "warn" | "info";
  if (availableCount === 0) {
    label = "Single-AI fallback (both reviewers unavailable)";
    tone = "warn";
  } else if (availableCount === 1) {
    const who = codexAvailable ? "Codex" : "Gemini";
    label = `Partial review — only ${who} was available (${addressed}/${total} concerns addressed)`;
    tone = "warn";
  } else if (allApproved) {
    label = "Approved by both reviewers (no concerns)";
    tone = "good";
  } else {
    label = `${addressed}/${total} concerns from Codex + Gemini addressed in revision`;
    tone = addressed === total ? "good" : "info";
  }

  const toneColor =
    tone === "good"
      ? "var(--good)"
      : tone === "warn"
        ? "var(--warn)"
        : "var(--accent)";

  const verdictChip = (name: string, verdict: string) => {
    const color =
      verdict === "approve"
        ? "var(--good)"
        : verdict === "revise"
          ? "var(--warn)"
          : verdict === "reject"
            ? "var(--danger)"
            : "var(--text-dim)";
    return (
      <span
        key={name}
        className="mono"
        style={{
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: 999,
          border: `1px solid color-mix(in oklch, ${color} 45%, var(--line))`,
          background: `color-mix(in oklch, ${color} 10%, transparent)`,
          color,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {name}: {verdict}
      </span>
    );
  };

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
        flexWrap: "wrap",
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
          TRIPLE-AI COLLABORATION
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-1)" }}>{label}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {verdictChip("Codex", verdicts.codex)}
          {verdictChip("Gemini", verdicts.gemini)}
        </div>
      </div>
      {availableCount > 0 && c.initialProjectedApy !== c.finalProjectedApy ? (
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
                  {p.sources && p.sources.length > 0 ? (
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: p.sources.length > 1 ? "var(--accent)" : "var(--text-dim)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        marginRight: 6,
                      }}
                    >
                      · {p.sources.length > 1 ? "both" : p.sources[0]}
                    </span>
                  ) : null}
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
