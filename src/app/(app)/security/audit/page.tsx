"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Icons, ThemeToggle } from "@/components/sovereign";
import type { AuditReport } from "@/types/audit";

interface JobStatus {
  jobId?: string;
  status: "idle" | "running" | "done" | "error";
  progress: number;
  stage?: string;
  message: string;
  result?: AuditReport;
  error?: string;
  elapsedMs?: number;
}

const CHAINS = [
  { id: 1, name: "Ethereum" },
  { id: 42161, name: "Arbitrum" },
  { id: 10, name: "Optimism" },
  { id: 8453, name: "Base" },
  { id: 137, name: "Polygon" },
  { id: 56, name: "BSC" },
  { id: 43114, name: "Avalanche" },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#6b7280",
};

const ENGINE_LABEL: Record<string, string> = {
  slither: "Source Coverage",
  aderyn: "Structure Coverage",
  mythril: "Execution Coverage",
  regex_pattern: "Pattern Coverage",
  ai_explainer: "Report Coverage",
  onchain_interrogator: "Control Coverage",
};

function prettyEngine(t: string): string {
  return ENGINE_LABEL[t] ?? t;
}

const STAGE_LABEL: Record<string, string> = {
  idle: "Ready",
  starting: "Starting review",
  starting_review: "Starting review",
  fetching_source: "Collecting contract context",
  collecting_context: "Collecting contract context",
  fetching_onchain: "Reading live contract state",
  reading_live_state: "Reading live contract state",
  running_tools: "Reviewing risk coverage",
  reviewing_coverage: "Reviewing risk coverage",
  consensus: "Prioritizing findings",
  prioritizing_findings: "Prioritizing findings",
  ai_explanation: "Preparing summary",
  preparing_summary: "Preparing summary",
  scsvs_mapping: "Mapping standards",
  mapping_standards: "Mapping standards",
  assembling_report: "Preparing report",
  preparing_report: "Preparing report",
  done: "Complete",
  complete: "Complete",
  error: "Error",
};

function stageLabel(stage?: string): string {
  if (!stage) return "Review";
  return STAGE_LABEL[stage] ?? stage.replace(/_/g, " ");
}

function reviewCopy(message?: string): string {
  if (!message) return "";
  return message
    .replace(/multi-engine audit pipeline/gi, "contract review")
    .replace(/audit pipeline/gi, "contract review")
    .replace(/audit/gi, "review")
    .replace(/Triple-AI explainer/gi, "Report review")
    .replace(/AI explainer/gi, "Report review")
    .replace(/AI panel/gi, "Review panel")
    .replace(/Slither|Aderyn|Mythril/gi, "review coverage")
    .replace(/static & symbolic analyzers/gi, "risk checks")
    .replace(/tools?/gi, "checks");
}

export default function MultiEngineAuditPage() {
  return (
    <Suspense fallback={<div className="page-wrap" style={{ fontSize: 13, color: "var(--text-dim)" }}>Loading security console…</div>}>
      <AuditConsole />
    </Suspense>
  );
}

function AuditConsole() {
  const searchParams = useSearchParams();
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(1);
  const [job, setJob] = useState<JobStatus>({ status: "idle", progress: 0, message: "" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autostartedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Prefill from query string and optionally auto-start the contract review
  // from an allocation row.
  useEffect(() => {
    if (autostartedRef.current) return;
    const urlAddr = (searchParams.get("address") ?? "").trim();
    const urlChain = searchParams.get("chain");
    const autostart = searchParams.get("autostart") === "1";

    let resolvedChain = chainId;
    if (urlChain) {
      const asNum = Number(urlChain);
      if (Number.isFinite(asNum) && CHAINS.some((c) => c.id === asNum)) {
        resolvedChain = asNum;
      } else {
        const match = CHAINS.find((c) => c.name.toLowerCase() === urlChain.toLowerCase());
        if (match) resolvedChain = match.id;
      }
      setChainId(resolvedChain);
    }
    if (urlAddr && /^0x[a-fA-F0-9]{40}$/.test(urlAddr)) {
      setAddress(urlAddr);
      if (autostart) {
        autostartedRef.current = true;
        void startAudit(urlAddr, resolvedChain);
      }
    }
    // searchParams identity is stable per navigation; intentionally re-run only
    // if it changes (e.g., user navigates with new params).
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startAudit(addrArg?: string, chainArg?: number) {
    const targetAddress = addrArg ?? address;
    const targetChain = chainArg ?? chainId;
    if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
      setJob({ status: "error", progress: 0, message: "", error: "Invalid Ethereum address" });
      return;
    }
    setJob({ status: "running", progress: 0, message: "Starting review…" });

    try {
      const res = await fetch("/api/security/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddress, chain: targetChain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(reviewCopy(data.error ?? "Failed to start review"));

      const jobId = data.jobId;
      setJob({ jobId, status: "running", progress: 0, message: reviewCopy(data.message) });

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch(`/api/security/audit/status?id=${jobId}`);
          const sd = await s.json();
          if (!s.ok) throw new Error(reviewCopy(sd.error ?? "Status fetch failed"));
          setJob({
            jobId,
            status: sd.status,
            progress: sd.progress,
            stage: sd.stage,
            message: reviewCopy(sd.message),
            result: sd.result,
            error: sd.error,
            elapsedMs: sd.elapsedMs,
          });
          if (sd.status === "done" || sd.status === "error") {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch (err) {
          setJob({
            status: "error",
            progress: 0,
            message: "",
            error: err instanceof Error ? err.message : String(err),
          });
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 2_000);
    } catch (err) {
      setJob({
        status: "error",
        progress: 0,
        message: "",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const r = job.result;

  return (
    <div className="page-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="eyebrow">SECURITY</div>
          <h1 className="display" style={{ fontSize: 28, margin: "6px 0 2px", letterSpacing: "-0.02em" }}>
            Contract risk review.
          </h1>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Review ownership, upgradeability, verification status, and material findings before relying on a contract.
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* ---------- INPUT ---------- */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 140px", gap: 10, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Contract address
            </label>
            <input
              type="text"
              placeholder="0x…"
              value={address}
              onChange={(e) => setAddress(e.target.value.trim())}
              spellCheck={false}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                fontFamily: "ui-monospace, monospace",
                background: "var(--surface-2)",
                color: "var(--text-1)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                marginTop: 6,
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Chain
            </label>
            <select
              value={chainId}
              onChange={(e) => setChainId(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                background: "var(--surface-2)",
                color: "var(--text-1)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                marginTop: 6,
              }}
            >
              {CHAINS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => startAudit()}
            disabled={job.status === "running" || !address}
            style={{ height: 40 }}
          >
            {job.status === "running" ? "Reviewing…" : "Run review"}
          </button>
        </div>

        {(job.status === "running" || job.status === "error" || job.status === "done") && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: "var(--text-dim)" }}>{stageLabel(job.stage ?? job.status)}</span>
              <span className="mono" style={{ color: "var(--text-1)" }}>{job.progress}%</span>
            </div>
            <div style={{ height: 4, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  width: `${job.progress}%`,
                  height: "100%",
                  background: job.status === "error" ? "#ef4444" : "var(--accent)",
                  transition: "width .3s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6 }}>{reviewCopy(job.message)}</div>
            {job.error && (
              <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>Error: {job.error}</div>
            )}
          </div>
        )}
      </div>

      {/* ---------- RESULT ---------- */}
      {r && (
        <>
          {/* Verdict + meta */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div className="eyebrow">RISK VIEW</div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: verdictColor(r.verdict),
                    textTransform: "uppercase",
                    letterSpacing: "-0.02em",
                    marginTop: 4,
                  }}
                >
                  {riskClassLabel(r.verdict)}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
                  Risk score {r.riskScore}/100 · {r.findings.length} material findings
                </div>
              </div>
              <div style={{ flex: "2 1 360px", minWidth: 0, fontSize: 13, lineHeight: 1.55 }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>EXECUTIVE SUMMARY</div>
                {r.executiveSummary}
              </div>
            </div>
          </div>

          {/* Contract meta */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Contract</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 12.5 }}>
              <Field label="Address" value={r.meta.address} mono />
              <Field label="Chain" value={r.chainName} />
              <Field label="Verified" value={r.meta.isVerified ? "yes" : "NO"} accent={!r.meta.isVerified ? "danger" : undefined} />
              <Field label="Name" value={r.meta.contractName ?? "—"} />
              <Field label="Compiler" value={r.meta.compilerVersion ?? "—"} mono />
              <Field label="Bytecode size" value={`${r.meta.bytecodeSize.toLocaleString()} bytes`} />
              <Field label="Age" value={r.meta.ageDays !== undefined ? `${r.meta.ageDays}d` : "—"} />
              <Field label="Deployer" value={r.meta.deployerAddress ?? "—"} mono />
            </div>
          </div>

          {/* Proxy + admin */}
          {(r.proxy.isProxy || r.admin.ownerAddress) && (
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Governance & upgradeability</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 12.5 }}>
                <Field label="Proxy pattern" value={r.proxy.pattern} accent={r.proxy.isProxy ? "warn" : undefined} />
                {r.proxy.implementationAddress && <Field label="Implementation" value={r.proxy.implementationAddress} mono />}
                {r.admin.ownerAddress && <Field label="Owner" value={r.admin.ownerAddress} mono />}
                {r.admin.renounced && <Field label="Renounced" value="yes" accent="good" />}
                {r.admin.ownerIsContract !== undefined && (
                  <Field
                    label="Owner type"
                    value={r.admin.ownerIsContract ? "contract" : "EOA"}
                    accent={r.admin.ownerIsContract ? undefined : "danger"}
                  />
                )}
                {r.admin.multisigThreshold !== undefined && (
                  <Field label="Multisig" value={`${r.admin.multisigThreshold}/${r.admin.multisigOwners ?? "?"}`} accent="good" />
                )}
                {r.admin.timelockDelaySeconds !== undefined && (
                  <Field
                    label="Timelock delay"
                    value={`${Math.floor(r.admin.timelockDelaySeconds / 3600)}h`}
                    accent={r.admin.timelockDelaySeconds >= 86400 ? "good" : "warn"}
                  />
                )}
              </div>
            </div>
          )}

          {/* Review coverage */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Review coverage</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 12.5 }}>
              {r.toolResults.map((t) => (
                <div key={t.tool} style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 6, border: "1px solid var(--line)" }}>
                  <div style={{ fontWeight: 600, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.06em" }}>
                    {prettyEngine(t.tool)}
                  </div>
                  <div style={{ color: t.available ? (t.rawError ? "#f97316" : "var(--text-1)") : "var(--text-dim)", marginTop: 2 }}>
                    {t.available ? `${t.findings.length} finding${t.findings.length === 1 ? "" : "s"} · complete` : "coverage unavailable"}
                  </div>
                  {!t.available && t.unavailableReason && (
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>This coverage area could not be completed.</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Findings */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Icons.activity size={15} style={{ color: "var(--accent)" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Material findings</div>
              <span className="chip mono" style={{ marginLeft: "auto" }}>{r.findings.length} total</span>
            </div>
            {r.findings.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>No findings surfaced.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {r.findings.map((f) => (
                  <div key={f.id} style={{ padding: 14, background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          fontSize: 10.5,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          background: SEVERITY_COLORS[f.severity] + "33",
                          color: SEVERITY_COLORS[f.severity],
                          borderRadius: 4,
                        }}
                      >
                        {f.severity}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        {f.confidence}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{f.title}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-dim)" }}>
                        {f.toolsAgreed.length} coverage area{f.toolsAgreed.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {f.filePath && (
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                        {f.filePath}{f.startLine ? `:${f.startLine}` : ""}
                      </div>
                    )}
                    <div style={{ fontSize: 12.5, color: "var(--text-1)", marginTop: 8, lineHeight: 1.55 }}>
                      {f.aiExplanation?.whatHappened ?? f.description}
                    </div>
                    {f.aiExplanation?.whyItMatters && (
                      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.5 }}>
                        <strong style={{ color: "var(--text-1)" }}>Why it matters:</strong> {f.aiExplanation.whyItMatters}
                      </div>
                    )}
                    {f.aiExplanation?.recommendedFix && (
                      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.5 }}>
                        <strong style={{ color: "var(--text-1)" }}>Fix:</strong> {f.aiExplanation.recommendedFix}
                      </div>
                    )}
                    {f.aiExplanation && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>
                        Review status: {f.aiExplanation.aiConsensus}
                      </div>
                    )}
                    {f.codeSnippet && (
                      <pre className="mono" style={{ fontSize: 11, padding: 10, marginTop: 8, background: "var(--surface-3)", borderRadius: 4, overflow: "auto", maxHeight: 180 }}>
                        {f.codeSnippet}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SCSVS */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
              Security standard coverage · {r.scsvs.summary.passed}/{r.scsvs.summary.total} pass
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8, fontSize: 12 }}>
              {r.scsvs.checks.map((c) => (
                <div key={c.id} style={{ padding: 10, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>{c.id}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", color: scsvsColor(c.status) }}>
                      {c.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{c.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {r.recommendations.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Recommendations</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                {r.recommendations.map((rec, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {r.warnings.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#f97316" }}>Review notices</div>
              <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--text-dim)" }}>
                Some coverage was limited during this review. Treat the result as decision support, not a substitute for legal, financial, or manual security diligence.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function verdictColor(v: string): string {
  if (v === "critical") return "#ef4444";
  if (v === "dangerous") return "#f97316";
  if (v === "review") return "#eab308";
  return "#22c55e";
}

function riskClassLabel(v: string): string {
  if (v === "critical") return "critical";
  if (v === "dangerous") return "high risk";
  if (v === "review") return "review required";
  return "clear";
}

function scsvsColor(status: string): string {
  if (status === "pass") return "#22c55e";
  if (status === "fail") return "#ef4444";
  if (status === "manual_review") return "#eab308";
  if (status === "indeterminate") return "#6b7280";
  return "var(--text-dim)";
}

function Field({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "good" | "warn" | "danger";
}) {
  const color =
    accent === "good"
      ? "#22c55e"
      : accent === "warn"
      ? "#f97316"
      : accent === "danger"
      ? "#ef4444"
      : "var(--text-1)";
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div
        className={mono ? "mono" : undefined}
        style={{
          fontSize: mono ? 11.5 : 13,
          color,
          marginTop: 4,
          wordBreak: mono ? "break-all" : "normal",
        }}
      >
        {value}
      </div>
    </div>
  );
}
