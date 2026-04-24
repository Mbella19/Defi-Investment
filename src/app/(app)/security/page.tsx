"use client";

import { useEffect, useMemo, useState } from "react";
import { Eyebrow, Icons, fmt } from "@/components/sovereign";
import { loadStrategies } from "@/lib/storage";
import HealthView from "@/components/views/HealthView";
import type {
  DeployerForensicsReport,
  SourceAuditReport,
  RelevantAlert,
  DeployerFlag,
  AuditFinding,
  Severity,
} from "@/types/security";

type Tab = "forensics" | "audit" | "alerts" | "health";

const CHAINS = [
  { id: 1, name: "Ethereum" },
  { id: 8453, name: "Base" },
  { id: 42161, name: "Arbitrum" },
  { id: 10, name: "Optimism" },
  { id: 137, name: "Polygon" },
  { id: 56, name: "BSC" },
];

export default function SecurityPage() {
  const [tab, setTab] = useState<Tab>("forensics");

  return (
    <div style={{ padding: "48px 32px", maxWidth: 1280, margin: "0 auto" }}>
      <Hero />
      <TabBar tab={tab} setTab={setTab} />
      {tab === "forensics" && <ForensicsTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "alerts" && <AlertsTab />}
      {tab === "health" && <HealthView />}
    </div>
  );
}

/* ==================== HERO + TABS ==================== */

function Hero() {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 48, alignItems: "end" }}>
        <div>
          <Eyebrow>On-Chain Forensics</Eyebrow>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(48px, 7vw, 96px)",
              lineHeight: 0.92,
              letterSpacing: "-0.04em",
              marginTop: 20,
              marginBottom: 20,
            }}
          >
            Security
            <br />
            <span style={{ fontStyle: "italic", color: "var(--accent)" }}>intelligence.</span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-dim)", maxWidth: 580, lineHeight: 1.6 }}>
            Deployer wallet forensics, line-level source audits, and live exploit relay — every
            finding grounded in verifiable on-chain evidence, reconciled by Claude, never
            hallucinated.
          </p>
        </div>
        <div
          className="brackets"
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: 20,
            minWidth: 260,
          }}
        >
          <Eyebrow>Evidence Sources</Eyebrow>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              marginTop: 12,
              background: "var(--line)",
              border: "1px solid var(--line)",
            }}
          >
            {[
              ["ETHERSCAN", "ON-CHAIN"],
              ["DEFILLAMA", "HACKS"],
              ["CLAUDE", "OPUS 4.6"],
              ["HEURISTIC", "ANOMALY"],
            ].map(([src, tag]) => (
              <div key={src} style={{ background: "var(--surface)", padding: "10px 12px" }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    color: "var(--accent)",
                    textTransform: "uppercase",
                  }}
                >
                  {src}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, letterSpacing: "0.1em" }}
                >
                  {tag}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "forensics", label: "Deployer Forensics" },
    { id: "audit", label: "Source Audit" },
    { id: "alerts", label: "Live Alerts" },
    { id: "health", label: "Protocol Health" },
  ];
  return (
    <div style={{ display: "flex", borderBottom: "1px solid var(--line)", marginBottom: 32 }}>
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="mono"
            style={{
              padding: "14px 20px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
              marginBottom: -1,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: active ? "var(--accent)" : "var(--text-dim)",
              cursor: "pointer",
              fontWeight: active ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ==================== SHARED UI ==================== */

function ContractInput({
  address,
  setAddress,
  chainId,
  setChainId,
  loading,
  onSubmit,
  placeholder,
  cta,
}: {
  address: string;
  setAddress: (s: string) => void;
  chainId: number;
  setChainId: (n: number) => void;
  loading: boolean;
  onSubmit: () => void;
  placeholder: string;
  cta: string;
}) {
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <Eyebrow>Target</Eyebrow>
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 12, marginTop: 16 }}>
        <select
          value={chainId}
          onChange={(e) => setChainId(Number(e.target.value))}
          className="mono"
          style={{
            padding: "12px 14px",
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            color: "var(--text)",
            fontSize: 12,
            letterSpacing: "0.1em",
          }}
        >
          {CHAINS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name.toUpperCase()}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder={placeholder}
          className="mono"
          style={{
            padding: "12px 14px",
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            color: "var(--text)",
            fontSize: 12,
            letterSpacing: "0.04em",
          }}
        />
        <button
          onClick={onSubmit}
          disabled={loading}
          className="mono"
          style={{
            padding: "12px 24px",
            background: loading ? "var(--surface-2)" : "var(--accent)",
            color: loading ? "var(--text-dim)" : "#07080C",
            border: "none",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Analyzing…" : cta}
        </button>
      </div>
    </div>
  );
}

function Blink() {
  return (
    <span style={{ color: "var(--accent)", animation: "blink 1s step-end infinite" }}>█</span>
  );
}

function SeverityPill({ severity }: { severity: Severity | "safe" | "caution" | "high_risk" | "avoid" | "clean" | "review" | "dangerous" }) {
  const s = severity.toLowerCase();
  const color =
    s === "critical" || s === "avoid" || s === "dangerous"
      ? "var(--danger)"
      : s === "high" || s === "high_risk"
        ? "var(--warn)"
        : s === "medium" || s === "caution" || s === "review"
          ? "var(--accent-dim)"
          : s === "low" || s === "safe" || s === "clean"
            ? "var(--accent)"
            : "var(--text-dim)";
  return (
    <span
      className="mono"
      style={{
        display: "inline-block",
        padding: "3px 8px",
        fontSize: 9,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        border: `1px solid ${color}`,
        color,
        background: `color-mix(in oklab, ${color} 10%, transparent)`,
      }}
    >
      {severity}
    </span>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--danger)",
        background: "color-mix(in oklab, var(--danger) 8%, transparent)",
        padding: 16,
        marginTop: 24,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          color: "var(--danger)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Error
      </div>
      <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{message}</div>
    </div>
  );
}

/* ==================== FORENSICS TAB ==================== */

function ForensicsTab() {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DeployerForensicsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/security/forensics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: address.trim(), chain: chainId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Forensics failed");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Forensics failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <ContractInput
        address={address}
        setAddress={setAddress}
        chainId={chainId}
        setChainId={setChainId}
        loading={loading}
        onSubmit={run}
        placeholder="Contract address — 0x…"
        cta="Trace"
      />
      {error && <ErrorBox message={error} />}
      {loading && (
        <div className="mono" style={{ color: "var(--text-dim)", fontSize: 12, padding: 32 }}>
          TRACING DEPLOYER{" "}
          <Blink />
        </div>
      )}
      {data && <ForensicsReport data={data} />}
    </div>
  );
}

function ForensicsReport({ data }: { data: DeployerForensicsReport }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <ForensicsHeader data={data} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <TraceFactsPanel data={data} />
        <FlagsPanel flags={data.trace.flags} />
      </div>
      {data.trace.fundingSources.length > 0 && <FundingTable sources={data.trace.fundingSources} />}
      {data.trace.priorExploits.length > 0 && <PriorExploitsPanel exploits={data.trace.priorExploits} />}
      <AiSynthesisPanel
        summary={data.summary}
        reasoning={data.reasoning}
        recommendations={data.recommendations}
      />
    </div>
  );
}

function ForensicsHeader({ data }: { data: DeployerForensicsReport }) {
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "end" }}>
        <div>
          <Eyebrow>{data.trace.chainName} · Deployer Trace</Eyebrow>
          <div
            className="mono"
            style={{
              fontSize: 13,
              color: "var(--text-dim)",
              marginTop: 12,
              letterSpacing: "0.02em",
              wordBreak: "break-all",
            }}
          >
            creator: <span style={{ color: "var(--text)" }}>{data.trace.creatorAddress}</span>
          </div>
          <div
            className="mono"
            style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4, letterSpacing: "0.02em", wordBreak: "break-all" }}
          >
            contract: {data.trace.contractAddress}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            className="serif tabular"
            style={{
              fontSize: 72,
              lineHeight: 1,
              color: "var(--accent)",
              letterSpacing: "-0.02em",
            }}
          >
            {data.score}
          </div>
          <div style={{ marginTop: 8 }}>
            <SeverityPill severity={data.riskLevel} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TraceFactsPanel({ data }: { data: DeployerForensicsReport }) {
  const rows: [string, string][] = [
    ["Creator Age", data.trace.creatorAgeDays !== null ? `${data.trace.creatorAgeDays} days` : "unknown"],
    ["Tx Count", data.trace.creatorTxCount !== null ? String(data.trace.creatorTxCount) : "200+"],
    [
      "First Seen",
      data.trace.creatorFirstSeen
        ? new Date(data.trace.creatorFirstSeen * 1000).toISOString().slice(0, 10)
        : "—",
    ],
    ["Sibling Contracts", String(data.trace.otherDeployments.length)],
    ["Funding Sources", String(data.trace.fundingSources.length)],
    ["Prior Exploits", String(data.trace.priorExploits.length)],
  ];
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 24 }}
    >
      <Eyebrow>Trace Facts</Eyebrow>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 1,
          marginTop: 16,
          background: "var(--line)",
          border: "1px solid var(--line)",
        }}
      >
        {rows.map(([k, v]) => (
          <div key={k} style={{ background: "var(--surface)", padding: "12px 14px" }}>
            <div
              className="mono"
              style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--text-dim)", textTransform: "uppercase" }}
            >
              {k}
            </div>
            <div className="mono tabular" style={{ fontSize: 14, color: "var(--text)", marginTop: 6 }}>
              {v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlagsPanel({ flags }: { flags: DeployerFlag[] }) {
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 24 }}
    >
      <Eyebrow>Signals · {flags.length}</Eyebrow>
      {flags.length === 0 ? (
        <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 13 }}>No signals raised.</div>
      ) : (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
          {flags.map((f, i) => (
            <div
              key={i}
              style={{
                background: "var(--surface)",
                padding: "12px 14px",
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 12,
                alignItems: "center",
              }}
            >
              <SeverityPill severity={f.severity} />
              <div>
                <div
                  className="mono"
                  style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--text-dim)", textTransform: "uppercase" }}
                >
                  {f.code}
                </div>
                <div style={{ fontSize: 13, color: "var(--text)", marginTop: 3 }}>{f.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FundingTable({ sources }: { sources: DeployerForensicsReport["trace"]["fundingSources"] }) {
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 24 }}
    >
      <Eyebrow>Funding Trace</Eyebrow>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto auto auto",
          gap: 1,
          marginTop: 16,
          background: "var(--line)",
          border: "1px solid var(--line)",
        }}
      >
        {["CLASS", "FROM", "VALUE", "DATE", "TX"].map((h) => (
          <div
            key={h}
            style={{ background: "var(--surface-2)", padding: "10px 12px" }}
            className="mono"
          >
            <span style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--text-dim)" }}>{h}</span>
          </div>
        ))}
        {sources.map((s) => (
          <FundingRow key={s.firstFundingTxHash} source={s} />
        ))}
      </div>
    </div>
  );
}

function FundingRow({ source }: { source: DeployerForensicsReport["trace"]["fundingSources"][number] }) {
  const riskColor =
    source.riskCategory === "tornado" || source.riskCategory === "mixer"
      ? "var(--danger)"
      : source.riskCategory === "cex"
        ? "var(--accent)"
        : "var(--text-dim)";
  return (
    <>
      <div style={{ background: "var(--surface)", padding: "12px 14px" }}>
        <span
          className="mono"
          style={{ fontSize: 10, color: riskColor, textTransform: "uppercase", letterSpacing: "0.14em" }}
        >
          {source.riskCategory}
        </span>
      </div>
      <div style={{ background: "var(--surface)", padding: "12px 14px" }}>
        <div className="mono" style={{ fontSize: 12, color: "var(--text)", wordBreak: "break-all" }}>
          {source.label || `${source.address.slice(0, 14)}…${source.address.slice(-6)}`}
        </div>
      </div>
      <div style={{ background: "var(--surface)", padding: "12px 14px" }}>
        <span className="mono tabular" style={{ fontSize: 12, color: "var(--accent)" }}>
          {source.firstFundingValueEth.toFixed(4)} ETH
        </span>
      </div>
      <div style={{ background: "var(--surface)", padding: "12px 14px" }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {new Date(source.firstFundingTimestamp * 1000).toISOString().slice(0, 10)}
        </span>
      </div>
      <div style={{ background: "var(--surface)", padding: "12px 14px" }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {source.firstFundingTxHash.slice(0, 10)}…
        </span>
      </div>
    </>
  );
}

function PriorExploitsPanel({ exploits }: { exploits: DeployerForensicsReport["trace"]["priorExploits"] }) {
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--danger)",
        background: "color-mix(in oklab, var(--danger) 4%, var(--surface))",
        padding: 24,
      }}
    >
      <Eyebrow>Prior Exploit Matches · {exploits.length}</Eyebrow>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
        {exploits.map((e, i) => (
          <div
            key={i}
            style={{ background: "var(--surface)", padding: "14px 16px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div className="mono" style={{ fontSize: 12, color: "var(--danger)", letterSpacing: "0.04em" }}>
                {e.name}
              </div>
              <div className="mono tabular" style={{ fontSize: 12, color: "var(--text)" }}>
                ${fmt.compact(e.amount)}
              </div>
            </div>
            <div
              className="mono"
              style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, letterSpacing: "0.02em" }}
            >
              {new Date(e.date * 1000).toISOString().slice(0, 10)} · {e.technique}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiSynthesisPanel({
  summary,
  reasoning,
  recommendations,
}: {
  summary: string;
  reasoning: string[];
  recommendations: string[];
}) {
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <Eyebrow>AI Synthesis · Claude Opus 4.7</Eyebrow>
      <p
        className="serif"
        style={{
          fontSize: 20,
          lineHeight: 1.45,
          color: "var(--text)",
          marginTop: 18,
          maxWidth: 820,
          fontStyle: "italic",
        }}
      >
        {summary}
      </p>
      {reasoning.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Eyebrow>Reasoning</Eyebrow>
          <ul style={{ margin: "12px 0 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {reasoning.map((r, i) => (
              <li
                key={i}
                style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5, paddingLeft: 16, position: "relative" }}
              >
                <span style={{ position: "absolute", left: 0, color: "var(--accent)" }}>›</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {recommendations.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Eyebrow>Recommendations</Eyebrow>
          <ul style={{ margin: "12px 0 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {recommendations.map((r, i) => (
              <li
                key={i}
                style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, paddingLeft: 16, position: "relative" }}
              >
                <span style={{ position: "absolute", left: 0, color: "var(--accent)" }}>→</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ==================== AUDIT TAB ==================== */

function AuditTab() {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SourceAuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/security/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: address.trim(), chain: chainId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Audit failed");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <ContractInput
        address={address}
        setAddress={setAddress}
        chainId={chainId}
        setChainId={setChainId}
        loading={loading}
        onSubmit={run}
        placeholder="Verified contract address — 0x…"
        cta="Audit"
      />
      <HallucinationGuardNote />
      {error && <ErrorBox message={error} />}
      {loading && (
        <div className="mono" style={{ color: "var(--text-dim)", fontSize: 12, padding: 32 }}>
          EXTRACTING CANDIDATES · RECONCILING WITH CLAUDE <Blink />
        </div>
      )}
      {data && <AuditReport data={data} />}
    </div>
  );
}

function HallucinationGuardNote() {
  return (
    <div
      style={{
        border: "1px dashed var(--line-2)",
        padding: "12px 16px",
        fontSize: 12,
        color: "var(--text-dim)",
        lineHeight: 1.5,
      }}
    >
      <span className="mono" style={{ color: "var(--accent)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" }}>
        Guard ·
      </span>{" "}
      Claude is shown only pre-extracted snippets from verified source and must confirm each
      finding with a verbatim code quote. Rejected claims (low confidence, bad quotes) are
      surfaced separately so nothing silently slips through.
    </div>
  );
}

function AuditReport({ data }: { data: SourceAuditReport }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <AuditHeader data={data} />
      <AuditStats data={data} />
      {data.findings.length === 0 ? (
        <div
          className="brackets"
          style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 32, textAlign: "center" }}
        >
          <div
            className="mono"
            style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase" }}
          >
            No Confirmed Findings
          </div>
          <p style={{ marginTop: 12, color: "var(--text-dim)", fontSize: 13, lineHeight: 1.6 }}>
            Pre-extracted {data.candidatesScanned} candidate region(s). Claude rejected{" "}
            {data.rejectedFindings} low-confidence or benign patterns. Always cross-check with
            a human auditor before large deposits.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {data.findings.map((f) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuditHeader({ data }: { data: SourceAuditReport }) {
  return (
    <div
      className="brackets"
      style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 28 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "end" }}>
        <div>
          <Eyebrow>{data.chainName} · Source Audit</Eyebrow>
          <h2
            className="serif"
            style={{ fontSize: 40, marginTop: 14, letterSpacing: "-0.02em", lineHeight: 1 }}
          >
            {data.contractName}
          </h2>
          <div
            className="mono"
            style={{
              fontSize: 12,
              color: "var(--text-dim)",
              marginTop: 8,
              letterSpacing: "0.02em",
              wordBreak: "break-all",
            }}
          >
            {data.contractAddress} · {data.compilerVersion}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            className="serif tabular"
            style={{ fontSize: 72, lineHeight: 1, color: "var(--accent)", letterSpacing: "-0.02em" }}
          >
            {data.overallScore}
          </div>
          <div style={{ marginTop: 8 }}>
            <SeverityPill severity={data.overallVerdict} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditStats({ data }: { data: SourceAuditReport }) {
  const rows: [string, string | number][] = [
    ["Lines of Code", fmt.compact(data.linesOfCode)],
    ["Candidates", data.candidatesScanned],
    ["Confirmed", data.findings.length],
    ["Rejected", data.rejectedFindings],
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 1,
        background: "var(--line)",
        border: "1px solid var(--line)",
      }}
    >
      {rows.map(([k, v]) => (
        <div key={k} style={{ background: "var(--surface)", padding: "16px 18px" }}>
          <div
            className="mono"
            style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--text-dim)", textTransform: "uppercase" }}
          >
            {k}
          </div>
          <div
            className="serif tabular"
            style={{ fontSize: 26, color: "var(--text)", marginTop: 6, letterSpacing: "-0.02em" }}
          >
            {v}
          </div>
        </div>
      ))}
    </div>
  );
}

function FindingCard({ finding }: { finding: AuditFinding }) {
  return (
    <div
      className="brackets"
      style={{
        border: `1px solid ${
          finding.severity === "critical"
            ? "var(--danger)"
            : finding.severity === "high"
              ? "var(--warn)"
              : "var(--line)"
        }`,
        background: "var(--surface)",
        padding: 22,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <SeverityPill severity={finding.severity} />
        <span
          className="mono"
          style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--text-dim)", textTransform: "uppercase" }}
        >
          {finding.category.replace(/_/g, " ")}
        </span>
        <span
          className="mono"
          style={{ fontSize: 10, color: "var(--accent)", letterSpacing: "0.1em" }}
        >
          L{finding.startLine}
          {finding.endLine !== finding.startLine ? `–L${finding.endLine}` : ""}
        </span>
        <span
          className="mono tabular"
          style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.1em", marginLeft: "auto" }}
        >
          CONFIDENCE {(finding.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <h3 className="serif" style={{ fontSize: 20, marginTop: 14, lineHeight: 1.3 }}>
        {finding.title}
      </h3>
      <p style={{ marginTop: 10, color: "var(--text-dim)", fontSize: 13, lineHeight: 1.6 }}>
        {finding.description}
      </p>
      <pre
        className="mono"
        style={{
          marginTop: 14,
          padding: 14,
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          color: "var(--text)",
          fontSize: 12,
          overflowX: "auto",
          lineHeight: 1.55,
          whiteSpace: "pre",
        }}
      >
        {finding.codeSnippet}
      </pre>
      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderLeft: "2px solid var(--accent)",
          background: "color-mix(in oklab, var(--accent) 6%, transparent)",
        }}
      >
        <div
          className="mono"
          style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase" }}
        >
          Recommendation
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: "var(--text)", lineHeight: 1.55 }}>
          {finding.recommendation}
        </div>
      </div>
    </div>
  );
}

/* ==================== ALERTS TAB ==================== */

function AlertsTab() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{
    alerts: RelevantAlert[];
    scannedAt: string;
    sources: { defillama: number; forta: number; heuristic: number };
    strategiesScanned: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const strategies = useMemo(() => {
    if (typeof window === "undefined") return [];
    return loadStrategies().flatMap((s, i) =>
      (s.allocations || []).map((a, j) => ({
        id: `${s.generatedAt || `strat-${i}`}::${a.poolId || j}`,
        protocol: a.protocol,
        symbol: a.symbol,
        chain: a.chain,
        poolId: a.poolId,
        addresses: [] as string[],
        investedAmount: a.allocationAmount,
        riskAppetite: s.criteria?.riskAppetite as "low" | "medium" | "high" | undefined,
      }))
    );
  }, []);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/security/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ strategies }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Alerts fetch failed");
      setReport(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Alerts fetch failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <AlertsControls
        strategies={strategies.length}
        scannedAt={report?.scannedAt || null}
        loading={loading}
        onRefresh={run}
      />
      {report && <AlertsSourceRow sources={report.sources} />}
      {error && <ErrorBox message={error} />}
      {loading && !report && (
        <div className="mono" style={{ color: "var(--text-dim)", fontSize: 12, padding: 32 }}>
          POLLING SOURCES <Blink />
        </div>
      )}
      {report && report.alerts.length === 0 && (
        <div
          className="brackets"
          style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 32, textAlign: "center" }}
        >
          <div
            className="mono"
            style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase" }}
          >
            All Clear
          </div>
          <p style={{ marginTop: 12, color: "var(--text-dim)", fontSize: 13 }}>
            No recent exploits detected across monitored feeds.
          </p>
        </div>
      )}
      {report && report.alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {report.alerts.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertsControls({
  strategies,
  scannedAt,
  loading,
  onRefresh,
}: {
  strategies: number;
  scannedAt: string | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 22,
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto",
        gap: 16,
        alignItems: "end",
      }}
    >
      <div>
        <Eyebrow>Watched Strategies</Eyebrow>
        <div
          className="serif tabular"
          style={{ fontSize: 36, marginTop: 8, letterSpacing: "-0.02em", lineHeight: 1 }}
        >
          {strategies}
        </div>
      </div>
      <div>
        <Eyebrow>Last Scan</Eyebrow>
        <div className="mono tabular" style={{ fontSize: 13, color: "var(--text)", marginTop: 12 }}>
          {scannedAt ? new Date(scannedAt).toLocaleTimeString() : "—"}
        </div>
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="mono"
        style={{
          padding: "12px 24px",
          background: loading ? "var(--surface-2)" : "var(--accent)",
          color: loading ? "var(--text-dim)" : "#07080C",
          border: "none",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icons.refresh />
        {loading ? "Scanning" : "Rescan"}
      </button>
    </div>
  );
}

function AlertsSourceRow({ sources }: { sources: { defillama: number; forta: number; heuristic: number } }) {
  const rows: [string, number][] = [
    ["DEFILLAMA", sources.defillama],
    ["FORTA", sources.forta],
    ["HEURISTIC", sources.heuristic],
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 1,
        background: "var(--line)",
        border: "1px solid var(--line)",
      }}
    >
      {rows.map(([k, v]) => (
        <div key={k} style={{ background: "var(--surface)", padding: "14px 16px" }}>
          <div
            className="mono"
            style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--accent)" }}
          >
            {k}
          </div>
          <div
            className="serif tabular"
            style={{ fontSize: 24, color: "var(--text)", marginTop: 4, letterSpacing: "-0.02em" }}
          >
            {v}
          </div>
        </div>
      ))}
    </div>
  );
}

function AlertCard({ alert }: { alert: RelevantAlert }) {
  const severityColor =
    alert.severity === "critical"
      ? "var(--danger)"
      : alert.severity === "high"
        ? "var(--warn)"
        : alert.severity === "medium"
          ? "var(--accent-dim)"
          : "var(--text-dim)";
  const relevancePct = (alert.relevanceScore * 100).toFixed(0);
  return (
    <div
      className="brackets"
      style={{
        border: `1px solid ${alert.affectedStrategyIds.length > 0 ? severityColor : "var(--line)"}`,
        background: "var(--surface)",
        padding: 22,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <SeverityPill severity={alert.severity} />
        <span
          className="mono"
          style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--text-dim)", textTransform: "uppercase" }}
        >
          {alert.source}
        </span>
        {alert.protocol && (
          <span className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.06em" }}>
            {alert.protocol}
          </span>
        )}
        <span
          className="mono tabular"
          style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.1em", marginLeft: "auto" }}
        >
          RELEVANCE {relevancePct}%
        </span>
      </div>
      <h3 className="serif" style={{ fontSize: 20, marginTop: 12, lineHeight: 1.3 }}>
        {alert.name}
      </h3>
      <div
        className="mono"
        style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, letterSpacing: "0.02em" }}
      >
        {new Date(alert.detectedAt * 1000).toLocaleString()}
      </div>
      <p style={{ marginTop: 10, color: "var(--text-dim)", fontSize: 13, lineHeight: 1.6 }}>
        {alert.description}
      </p>
      {alert.aiInterpretation && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderLeft: "2px solid var(--accent)",
            background: "color-mix(in oklab, var(--accent) 6%, transparent)",
          }}
        >
          <div
            className="mono"
            style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase" }}
          >
            Claude Interpretation
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--text)", lineHeight: 1.55 }}>
            {alert.aiInterpretation}
          </div>
        </div>
      )}
      {alert.actionItems.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Eyebrow>Action Items</Eyebrow>
          <ul style={{ margin: "10px 0 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {alert.actionItems.map((item, i) => (
              <li
                key={i}
                style={{ fontSize: 13, color: "var(--text)", paddingLeft: 16, position: "relative", lineHeight: 1.5 }}
              >
                <span style={{ position: "absolute", left: 0, color: "var(--accent)" }}>→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
