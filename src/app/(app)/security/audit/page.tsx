"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import {
  BookHeader,
  Console,
  PipelineRail,
  phasedSteps,
  type PipelinePhase,
  type TapeStat,
} from "@/components/site/ui";
import { usePlan } from "@/hooks/usePlan";
import { useSiweAuth } from "@/hooks/useSiweAuth";
import { apiFetch } from "@/lib/api-client";
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
  ai_explainer: "Analyst panel review",
  onchain_interrogator: "Control coverage",
};

/** The review's five phases, keyed by the job stages each covers. */
const REVIEW_PHASES: PipelinePhase[] = [
  { key: "source", label: "Source intake", stages: ["starting", "fetching_source"] },
  { key: "onchain", label: "On-chain state", stages: ["fetching_onchain"] },
  { key: "engines", label: "Engine sweep", stages: ["running_tools"] },
  { key: "consensus", label: "Consensus", stages: ["consensus", "ai_explanation"] },
  { key: "briefing", label: "Standards & briefing", stages: ["scsvs_mapping", "assembling_report"] },
];

function stageLabel(s?: string): string {
  if (!s) return "review";
  return STAGE_LABEL[s] ?? s.replace(/_/g, " ");
}

function reviewCopy(message?: string): string {
  if (!message) return "";
  return message
    .replace(/multi-engine audit pipeline/gi, "contract review")
    .replace(/audit pipeline/gi, "contract review")
    .replace(/Ensemble explainer/gi, "Report review")
    .replace(/AI explainer/gi, "Report review")
    .replace(/AI panel/gi, "Review panel")
    .replace(/Slither|Aderyn|Mythril/gi, "review coverage")
    .replace(/static & symbolic analyzers/gi, "risk checks");
}

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
  const plan = usePlan();
  const { status: authStatus, signIn } = useSiweAuth();
  const isAuthed = authStatus === "authed";
  const [address, setAddress] = useState("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  const [chainId, setChainId] = useState(1);
  const [job, setJob] = useState<JobView>({ status: "idle", progress: 0 });
  const [share, setShare] = useState<{
    busy: boolean;
    path?: string;
    error?: string;
    copied?: boolean;
    expiresAt?: string;
  }>({ busy: false });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autostartedRef = useRef(false);

  // A fresh run invalidates any previous share-link UI state.
  useEffect(() => {
    setShare({ busy: false });
  }, [job.jobId]);

  async function shareReport() {
    if (!job.jobId) return;
    if (share.path) {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}${share.path}`);
        setShare((current) => ({ ...current, copied: true, error: undefined }));
      } catch {
        setShare((current) => ({ ...current, copied: false }));
      }
      return;
    }
    setShare({ busy: true });
    try {
      const res = await apiFetch("/api/security/audit/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ jobId: job.jobId }),
      });
      const data = (await res.json()) as {
        path?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!res.ok || !data.path) {
        throw new Error(data.error ?? `Share failed (${res.status})`);
      }
      const url = `${window.location.origin}${data.path}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        /* clipboard unavailable — still show the link */
      }
      setShare({ busy: false, path: data.path, copied, expiresAt: data.expiresAt });
    } catch (err) {
      setShare({
        busy: false,
        error: err instanceof Error ? err.message : "Share failed",
      });
    }
  }

  async function revokeShare() {
    if (!job.jobId || !share.path) return;
    setShare((current) => ({ ...current, busy: true, error: undefined }));
    try {
      const res = await apiFetch("/api/security/audit/share", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.jobId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Revoke failed (${res.status})`);
      setShare({ busy: false });
    } catch (error) {
      setShare((current) => ({
        ...current,
        busy: false,
        error: error instanceof Error ? error.message : "Revoke failed",
      }));
    }
  }

  const auditCap = plan.capabilities.monthlyAudits;
  const auditsUsed = plan.usage.auditsThisMonth;
  const unlimited = auditCap === -1;
  const remaining = unlimited ? Infinity : Math.max(0, auditCap - auditsUsed);
  const atCap = !unlimited && remaining <= 0;

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
    // If wagmi connected but SIWE session is missing, transparently sign first.
    // Wallet shown in topbar → user thinks they're "signed in"; we shouldn't
    // make them click a separate sign-in button before the actual action.
    if (authStatus !== "authed") {
      const auth = await signIn();
      if (!auth.ok) {
        setJob({
          status: "error",
          progress: 0,
          error: "Wallet authorization was cancelled — accept the signature request to run a review.",
        });
        return;
      }
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setJob({ status: "running", progress: 1, message: "Starting review…" });
    try {
      const res = await apiFetch("/api/security/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddress, chain: targetChain }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setJob({
          status: "error",
          progress: 0,
          error: `Monthly audit cap reached on the ${data.tier ?? "current"} plan (${data.used}/${data.limit}). Upgrade to keep reviewing.`,
        });
        await plan.refetch();
        return;
      }
      if (!res.ok) throw new Error(reviewCopy(data.error ?? "Failed to start review"));
      // Tick the local usage counter so the gate updates immediately.
      await plan.refetch();

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
  const cleanCoverage = r?.coverage?.sufficientForCleanVerdict ?? false;

  const tape: TapeStat[] = [
    {
      label: "risk",
      value: r ? `${r.riskScore}/100` : "—",
      tone: r ? (r.riskScore >= 60 ? "danger" : r.riskScore >= 30 ? "warn" : "ok") : "plain",
    },
    { label: "findings", value: r ? String(findingsCount) : "—", tone: r && findingsCount > 0 ? "warn" : "plain" },
    { label: "coverage", value: r ? `${coverageCount}/${coverageTotal}` : "—", tone: "plain" },
    { label: "elapsed", value: elapsedLabel, tone: job.status === "running" ? "warn" : "plain" },
    ...(isAuthed && !plan.isLoading
      ? ([
          {
            label: "used",
            value: `${auditsUsed}/${unlimited ? "∞" : auditCap}`,
            tone: atCap ? "danger" : "plain",
          },
        ] as TapeStat[])
      : []),
  ];

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Security / Contract Review</p>
          <h1>Verify any contract, in minutes.</h1>
          <p>
            Paste an address. Get an institutional-grade security review with a clear
            verdict — source code, on-chain controls, governance posture, deployer history,
            and an analyst-led briefing — mapped to industry security standards. Built for
            capital, not curiosity.
          </p>
        </div>
      </div>

      <Console
        file="file/05.audit"
        chips={[
          { label: "source", value: validAddress ? "target valid" : "invalid", tone: validAddress ? "ok" : "danger" },
          {
            label: "engines",
            value: job.status === "running" ? "running" : job.status === "done" ? "complete" : "queued",
            tone: job.status === "running" ? "warn" : job.status === "done" ? "ok" : "info",
          },
          {
            label: "coverage",
            value: r ? (cleanCoverage ? "sufficient" : "limited") : "pending",
            tone: r && cleanCoverage ? "ok" : "warn",
          },
        ]}
        tape={tape}
      >
        <div className="desk-title">
          <div>
            <p className="eyebrow">Review console</p>
            <h2>Point it at a contract.</h2>
          </div>
        </div>

        <div className="ticket">
          <label className="ticket-grow">
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
            disabled={
              job.status === "running" ||
              !validAddress ||
              atCap ||
              authStatus === "checking" ||
              authStatus === "signing"
            }
          >
            <ShieldCheck size={18} aria-hidden="true" />
            {job.status === "running"
              ? "Reviewing"
              : authStatus === "checking"
                ? "Loading session…"
                : authStatus === "signing"
                  ? "Confirm in wallet…"
                  : atCap
                    ? "Monthly cap reached"
                    : "Run review"}
          </button>
        </div>

        {isAuthed && !plan.isLoading && atCap ? (
          <p className="ticket-note">
            Monthly review cap reached on the {plan.tier} plan —{" "}
            <Link
              href={plan.tier === "free" ? "/plans/checkout?tier=pro" : "/plans/checkout?tier=ultra"}
              style={{ color: "var(--mint)" }}
            >
              upgrade to keep reviewing
            </Link>
            .
          </p>
        ) : null}

        <PipelineRail steps={phasedSteps(REVIEW_PHASES, job.status, job.stage)} />

        <div>
          <div className="audit-progress" aria-label={`${job.progress}% complete`}>
            <i style={{ width: `${job.progress}%` }} />
          </div>
          <p
            style={{
              color: job.status === "error" ? "var(--coral)" : "var(--muted)",
              margin: "10px 0 0",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            {job.status === "error"
              ? job.error ?? "Review failed."
              : job.status === "running"
                ? `${stageLabel(job.stage)} · ${job.message ?? ""}`
                : job.status === "done"
                  ? "Review assembled."
                  : "Ready for target."}
          </p>
        </div>
      </Console>

      {r ? (
        <>
          <BookHeader
            index="05.1"
            title="Review report"
            meta={`${r.chainName} · ${shortAddress(r.meta.address)}`}
          />
          <div className="audit-stack">
            <div className="audit-card">
              <div className="audit-icon">
                <BadgeCheck size={24} color={verdictColor(r.verdict)} aria-hidden="true" />
              </div>
              <h3 style={{ textTransform: "capitalize" }}>{r.verdict} verdict</h3>
              <p>{r.executiveSummary}</p>
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="ghost-button"
                  onClick={shareReport}
                  disabled={share.busy || job.status !== "done"}
                >
                  {share.busy
                    ? "Creating link…"
                    : share.path
                      ? "Copy share link again"
                      : "Share report publicly"}
                </button>
                {share.path ? (
                  <>
                    <a
                      href={share.path}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: "var(--mint, #5AE4D4)" }}
                    >
                      {share.copied ? "Link copied — " : ""}open public page →
                    </a>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={revokeShare}
                      disabled={share.busy}
                    >
                      Revoke link
                    </button>
                    {share.expiresAt ? (
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        Expires {new Date(share.expiresAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </>
                ) : null}
                {share.error ? (
                  <span className="severity-medium" style={{ fontSize: 12 }}>
                    {share.error}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="engine-row">
              {r.toolResults.map((tool) => (
                <div
                  key={`coverage-${tool.tool}-${tool.scope?.kind ?? "general"}-${tool.scope?.address ?? "default"}`}
                  className="engine-cell"
                  data-live={tool.available ? "true" : "false"}
                >
                  <strong>
                    {ENGINE_LABEL[tool.tool] ?? tool.tool}
                    {tool.scope?.kind === "implementation" ? " · impl" : ""}
                  </strong>
                  <span>
                    {tool.available
                      ? `${tool.findings.length} finding${tool.findings.length === 1 ? "" : "s"}`
                      : tool.unavailableReason ?? "unavailable"}
                  </span>
                </div>
              ))}
            </div>

            <div className="desk-grid">
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
            </div>

            <div className="findings">
              {r.findings.length === 0 ? (
                <div className="finding">
                  <strong>No findings surfaced within available coverage</strong>
                  <span>
                    {cleanCoverage
                      ? "The configured analyzers and live-state checks completed without surfacing a finding. This is not a security guarantee."
                      : "Coverage was incomplete. Absence of a finding must be treated as unknown, not as evidence that the contract is safe."}
                  </span>
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

            {r.recommendations.length > 0 ? (
              <div className="boost-panel">
                <p className="eyebrow">Recommendations</p>
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
                  {r.recommendations.slice(0, 5).map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

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
