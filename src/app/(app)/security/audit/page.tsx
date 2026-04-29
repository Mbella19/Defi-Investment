"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  FileSearch,
  ShieldCheck,
  Siren,
  TimerReset,
} from "lucide-react";
import { CommandStrip, MetricTile } from "@/components/site/ui";
import type { AuditReport } from "@/types/audit";

const CHAINS: Array<{ id: number; name: string }> = [
  { id: 1, name: "Ethereum" },
  { id: 42161, name: "Arbitrum" },
  { id: 10, name: "Optimism" },
  { id: 8453, name: "Base" },
  { id: 137, name: "Polygon" },
  { id: 56, name: "BSC" },
  { id: 43114, name: "Avalanche" },
];

type ReviewState = "idle" | "running" | "done" | "error";

interface JobView {
  jobId?: string;
  status: ReviewState;
  progress: number;
  stage?: string;
  message?: string;
  result?: AuditReport;
  error?: string;
  elapsedMs?: number;
}

const STAGE_LABEL: Record<string, string> = {
  starting: "starting review",
  fetching_source: "collecting context",
  fetching_onchain: "reading live state",
  running_tools: "reviewing risk coverage",
  ai_explanation: "preparing summary",
  scsvs_mapping: "mapping standards",
  consensus: "prioritizing findings",
  assembling_report: "assembling report",
  done: "complete",
  error: "error",
};

const ENGINE_LABEL: Record<string, string> = {
  slither: "Source coverage",
  aderyn: "Structure coverage",
  mythril: "Execution coverage",
  regex_pattern: "Pattern coverage",
  ai_explainer: "Triple-AI synthesis",
  onchain_interrogator: "Control coverage",
};

function stageLabel(s?: string): string {
  if (!s) return "review";
  return STAGE_LABEL[s] ?? s.replace(/_/g, " ");
}

function reviewCopy(message?: string): string {
  if (!message) return "";
  return message
    .replace(/multi-engine audit pipeline/gi, "contract review")
    .replace(/audit pipeline/gi, "contract review")
    .replace(/Triple-AI explainer/gi, "Report review")
    .replace(/AI explainer/gi, "Report review")
    .replace(/AI panel/gi, "Review panel")
    .replace(/Slither|Aderyn|Mythril/gi, "review coverage")
    .replace(/static & symbolic analyzers/gi, "risk checks");
}

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

export default function AuditPage() {
  return (
    <Suspense fallback={<AuditSkeleton />}>
      <AuditConsole />
    </Suspense>
  );
}

function AuditSkeleton() {
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Security / Audit</p>
          <h1>Contract controls before conviction.</h1>
          <p>Loading review console…</p>
        </div>
      </div>
    </div>
  );
}

function AuditConsole() {
  const searchParams = useSearchParams();
  const [address, setAddress] = useState("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  const [chainId, setChainId] = useState(1);
  const [job, setJob] = useState<JobView>({ status: "idle", progress: 0 });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autostartedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
    if (urlAddr && isValidAddress(urlAddr)) {
      setAddress(urlAddr);
      if (autostart) {
        autostartedRef.current = true;
        void runReview(urlAddr, resolvedChain);
      }
    }
    // searchParams identity is stable per nav.
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runReview(addrArg?: string, chainArg?: number) {
    const targetAddress = (addrArg ?? address).trim();
    const targetChain = chainArg ?? chainId;
    if (!isValidAddress(targetAddress)) {
      setJob({ status: "error", progress: 0, error: "Enter a valid 0x-prefixed contract address." });
      return;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setJob({ status: "running", progress: 1, message: "Starting review…" });
    try {
      const res = await fetch("/api/security/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddress, chain: targetChain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(reviewCopy(data.error ?? "Failed to start review"));

      setJob({
        jobId: data.jobId,
        status: "running",
        progress: data.progress ?? 0,
        message: reviewCopy(data.message),
      });

      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch(`/api/security/audit/status?id=${data.jobId}`);
          const sd = await s.json();
          if (!s.ok) throw new Error(reviewCopy(sd.error ?? "Status fetch failed"));
          setJob({
            jobId: data.jobId,
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
            pollRef.current = null;
          }
        } catch (err) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setJob({
            status: "error",
            progress: 0,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }, 2_000);
    } catch (err) {
      setJob({
        status: "error",
        progress: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const r = job.result;
  const validAddress = isValidAddress(address);
  const elapsedLabel = job.elapsedMs
    ? `${Math.floor(job.elapsedMs / 60_000)
        .toString()
        .padStart(2, "0")}:${Math.floor((job.elapsedMs % 60_000) / 1000)
        .toString()
        .padStart(2, "0")}`
    : job.status === "running"
      ? "running"
      : "ready";

  const findingsCount = r?.findings.length ?? 0;
  const coverageCount = r?.toolResults.filter((t) => t.available).length ?? 0;
  const coverageTotal = r?.toolResults.length ?? 6;

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Security / Audit</p>
          <h1>Contract controls before conviction.</h1>
          <p>
            Six-engine review (source, structure, execution, pattern, on-chain interrogator,
            triple-AI synthesis) with SCSVS mapping. Heuristic vetoes still apply.
          </p>
        </div>
      </div>

      <CommandStrip
        file="file/05.audit"
        items={[
          { label: "source", value: validAddress ? "target valid" : "invalid", tone: validAddress ? "ok" : "danger" },
          { label: "engines", value: job.status === "running" ? "running" : job.status === "done" ? "complete" : "queued", tone: job.status === "running" ? "warn" : job.status === "done" ? "ok" : "info" },
          { label: "coverage", value: r ? `${coverageCount}/${coverageTotal}` : "pending", tone: r ? "ok" : "warn" },
        ]}
      />

      <div className="metric-grid" style={{ marginBottom: 18 }}>
        <MetricTile
          label="Risk score"
          value={r ? `${r.riskScore}/100` : "—"}
          icon={ShieldCheck}
          tone="#6ee7b7"
        />
        <MetricTile
          label="Findings"
          value={r ? String(findingsCount) : "—"}
          icon={AlertTriangle}
          tone="#fbbf24"
        />
        <MetricTile
          label="Coverage"
          value={r ? `${coverageCount}/${coverageTotal}` : "—"}
          icon={FileSearch}
          tone="#60a5fa"
        />
        <MetricTile label="Elapsed" value={elapsedLabel} icon={TimerReset} tone="#fb7185" />
      </div>

      <div className="audit-layout">
        <div className="audit-stack">
          <div className="boost-panel">
            <p className="eyebrow">Review Target</p>
            <div className="audit-form">
              <label>
                Contract address
                <input
                  className="address-input"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  spellCheck={false}
                  placeholder="0x…"
                />
              </label>
              <label>
                Chain
                <select
                  className="select-input"
                  value={chainId}
                  onChange={(event) => setChainId(Number(event.target.value))}
                >
                  {CHAINS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary-button"
                type="button"
                onClick={() => runReview()}
                disabled={job.status === "running" || !validAddress}
              >
                <ShieldCheck size={18} aria-hidden="true" />
                {job.status === "running" ? "Reviewing" : "Run review"}
              </button>
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="audit-progress" aria-label={`${job.progress}% complete`}>
                <i style={{ width: `${job.progress}%` }} />
              </div>
              <p style={{ color: job.status === "error" ? "var(--coral)" : "var(--muted)", marginTop: 10 }}>
                {job.status === "error"
                  ? job.error ?? "Review failed."
                  : job.status === "running"
                    ? `${stageLabel(job.stage)} · ${job.message ?? ""}`
                    : job.status === "done"
                      ? "Review assembled."
                      : "Ready for target."}
              </p>
            </div>
          </div>

          {r ? (
            <>
              <div className="audit-card">
                <div className="audit-icon">
                  <BadgeCheck size={24} color={verdictColor(r.verdict)} aria-hidden="true" />
                </div>
                <h3 style={{ textTransform: "capitalize" }}>{r.verdict} verdict</h3>
                <p>{r.executiveSummary}</p>
              </div>

              <div className="boost-panel">
                <p className="eyebrow">Contract</p>
                <div className="audit-meta-grid">
                  <Field label="Address" value={r.meta.address} />
                  <Field label="Chain" value={r.chainName} />
                  <Field label="Verified" value={r.meta.isVerified ? "yes" : "NO"} />
                  <Field label="Name" value={r.meta.contractName ?? "—"} />
                  <Field label="Compiler" value={r.meta.compilerVersion ?? "—"} />
                  <Field label="Bytecode" value={`${r.meta.bytecodeSize.toLocaleString()} bytes`} />
                  <Field label="Age" value={r.meta.ageDays !== undefined ? `${r.meta.ageDays}d` : "—"} />
                  <Field label="Deployer" value={r.meta.deployerAddress ?? "—"} />
                </div>
              </div>

              {r.proxy.isProxy || r.admin.ownerAddress ? (
                <div className="boost-panel">
                  <p className="eyebrow">Governance & upgradeability</p>
                  <div className="audit-meta-grid">
                    <Field label="Proxy pattern" value={r.proxy.pattern} />
                    {r.proxy.implementationAddress ? (
                      <Field label="Implementation" value={r.proxy.implementationAddress} />
                    ) : null}
                    {r.admin.ownerAddress ? <Field label="Owner" value={r.admin.ownerAddress} /> : null}
                    {r.admin.renounced ? <Field label="Renounced" value="yes" /> : null}
                    {r.admin.ownerIsContract !== undefined ? (
                      <Field label="Owner type" value={r.admin.ownerIsContract ? "contract" : "EOA"} />
                    ) : null}
                    {r.admin.multisigThreshold !== undefined ? (
                      <Field label="Multisig" value={`${r.admin.multisigThreshold}/${r.admin.multisigOwners ?? "?"}`} />
                    ) : null}
                    {r.admin.timelockDelaySeconds !== undefined ? (
                      <Field
                        label="Timelock"
                        value={`${Math.floor(r.admin.timelockDelaySeconds / 3600)}h`}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="findings">
                {r.findings.length === 0 ? (
                  <div className="finding">
                    <strong>No material findings</strong>
                    <span>The review surfaced no high-confidence findings.</span>
                  </div>
                ) : (
                  r.findings.map((finding) => (
                    <div className="finding" key={finding.id}>
                      <div className="audit-finding-head">
                        <span className="audit-pill" data-severity={finding.severity}>
                          {finding.severity}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 11 }}>
                          {finding.confidence}
                        </span>
                        <strong>{finding.title}</strong>
                      </div>
                      <span>
                        {finding.aiExplanation?.whatHappened ?? finding.description}
                      </span>
                      {finding.aiExplanation?.whyItMatters ? (
                        <span style={{ marginTop: 6 }}>
                          <strong>Why it matters · </strong>
                          {finding.aiExplanation.whyItMatters}
                        </span>
                      ) : null}
                      {finding.aiExplanation?.recommendedFix ? (
                        <span style={{ marginTop: 6 }}>
                          <strong>Fix · </strong>
                          {finding.aiExplanation.recommendedFix}
                        </span>
                      ) : null}
                      {finding.filePath ? (
                        <span style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                          {finding.filePath}
                          {finding.startLine ? `:${finding.startLine}` : ""}
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>

        <aside className="boost-panel">
          <p className="eyebrow">Coverage Map</p>
          <div className="signal-list">
            {(r?.toolResults ?? defaultCoverage).map((tool) => {
              const Icon = tool.available ? ShieldCheck : Siren;
              const tone = tool.available ? "#6ee7b7" : "#fbbf24";
              return (
                <div key={`coverage-${tool.tool}`} className="coverage-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon size={18} color={tone} />
                    <span className="coverage-name">{ENGINE_LABEL[tool.tool] ?? tool.tool}</span>
                  </div>
                  <div className="coverage-status">
                    {r
                      ? tool.available
                        ? `${tool.findings.length} findings`
                        : tool.unavailableReason ?? "unavailable"
                      : "queued"}
                  </div>
                </div>
              );
            })}
          </div>

          {r?.recommendations.length ? (
            <div style={{ marginTop: 16 }}>
              <p className="eyebrow">Recommendations</p>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
                {r.recommendations.slice(0, 5).map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

const defaultCoverage: AuditReport["toolResults"] = [
  { tool: "slither", available: true, durationMs: 0, findings: [] },
  { tool: "aderyn", available: true, durationMs: 0, findings: [] },
  { tool: "mythril", available: true, durationMs: 0, findings: [] },
  { tool: "regex_pattern", available: true, durationMs: 0, findings: [] },
  { tool: "onchain_interrogator", available: true, durationMs: 0, findings: [] },
  { tool: "ai_explainer", available: true, durationMs: 0, findings: [] },
];

function verdictColor(verdict: AuditReport["verdict"]): string {
  switch (verdict) {
    case "clean":
      return "#6ee7b7";
    case "review":
      return "#fbbf24";
    case "dangerous":
      return "#fb7185";
    case "critical":
      return "#ff4530";
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="audit-meta-cell">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}
