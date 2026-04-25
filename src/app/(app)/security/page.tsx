"use client";

import { Icons, Stat, RiskBar, ThemeToggle } from "@/components/sovereign";

type FeedTone = "info" | "good" | "warn" | "danger";
type FeedItem = { t: string; tone: FeedTone; ts: string; meta: string };

const FEED: FeedItem[] = [
  { t: "Pendle · governance proposal opened", tone: "info", ts: "12m ago", meta: "Quorum 4.2M vePENDLE" },
  { t: "Aave v3 · GHO oracle updated", tone: "info", ts: "2h ago", meta: "Chainlink feed 0x6aC…" },
  { t: "Balancer · deprecation notice on boosted wstETH", tone: "warn", ts: "1d ago", meta: "Migrate by 30d" },
  { t: "Morpho · new curator on Base vault", tone: "info", ts: "2d ago", meta: "Steakhouse Financial" },
  { t: "Curve · (resolved) frontend DNS anomaly", tone: "good", ts: "5d ago", meta: "No funds affected" },
];

const RISK_FACTORS = [
  { n: "Smart contract", v: 88 },
  { n: "Oracle", v: 94 },
  { n: "Governance", v: 82 },
  { n: "Counterparty", v: 90 },
  { n: "Liquidity depth", v: 76 },
  { n: "Depeg / correlation", v: 70 },
];

const STATS = [
  { label: "PROTOCOLS WATCHED", value: "12", sub: "in portfolio" },
  { label: "AUDIT COVERAGE", value: "92%", sub: "of portfolio weight" },
  { label: "ORACLE HEALTH", value: "OK", sub: "all Chainlink feeds nominal" },
  { label: "INCIDENTS · 30D", value: "0", sub: "across watched protocols" },
];

export default function SecurityPage() {
  return (
    <>
      {/* ---------- DESKTOP ---------- */}
      <div className="page-wrap">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div className="eyebrow">SECURITY</div>
            <h1
              className="display"
              style={{ fontSize: 28, margin: "6px 0 2px", letterSpacing: "-0.02em" }}
            >
              Risk telemetry
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
              Per-protocol incident feeds, oracle health, governance events
            </div>
          </div>
          <button type="button" className="btn btn-sm">
            <Icons.bell size={13} /> 2 new alerts
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {STATS.map((s) => (
            <div key={s.label} className="card" style={{ padding: 16 }}>
              <Stat size="sm" label={s.label} value={s.value} sub={s.sub} />
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Icons.activity size={15} style={{ color: "var(--accent)" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Incident feed</div>
              <span className="chip mono" style={{ marginLeft: "auto" }}>
                Immunefi · REKT · Forta
              </span>
            </div>
            {FEED.map((e, i) => (
              <div
                key={i}
                style={{
                  padding: "12px 18px",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  borderBottom: i === FEED.length - 1 ? "none" : "1px solid var(--line)",
                }}
              >
                <span className={`dot ${e.tone}`} style={{ marginTop: 6 }} />
                <div style={{ flex: 1, fontSize: 13 }}>
                  <div style={{ color: "var(--text-1)" }}>{e.t}</div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-dim)",
                      marginTop: 2,
                    }}
                  >
                    {e.meta}
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  {e.ts}
                </span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
              Risk factors in your portfolio
            </div>
            {RISK_FACTORS.map((r, i) => (
              <div
                key={r.n}
                style={{
                  padding: "10px 0",
                  borderBottom:
                    i < RISK_FACTORS.length - 1 ? "1px dashed var(--line)" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                    fontSize: 12.5,
                  }}
                >
                  <span>{r.n}</span>
                  <span className="mono" style={{ color: "var(--text-1)" }}>
                    {r.v}/100
                  </span>
                </div>
                <RiskBar value={r.v} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- MOBILE ---------- */}
      <div className="mobile-only">
        <div className="m-header">
          <div>
            <div className="m-title">Security</div>
            <div className="m-sub">RISK TELEMETRY · LIVE</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <ThemeToggle variant="mobile" />
            <button type="button" className="m-icon-btn" aria-label="Alerts">
              <Icons.bell size={18} />
            </button>
          </div>
        </div>
        <div className="m-content">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {STATS.map((s) => (
              <div key={`m-${s.label}`} className="card" style={{ padding: 12 }}>
                <Stat size="sm" label={s.label} value={s.value} sub={s.sub} />
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Icons.activity size={14} style={{ color: "var(--accent)" }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Incident feed</div>
            </div>
            {FEED.map((e, i) => (
              <div
                key={`m-${i}`}
                style={{
                  padding: "12px 14px",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  borderBottom: i === FEED.length - 1 ? "none" : "1px solid var(--line)",
                }}
              >
                <span className={`dot ${e.tone}`} style={{ marginTop: 5 }} />
                <div style={{ flex: 1, fontSize: 12.5, minWidth: 0 }}>
                  <div style={{ color: "var(--text-1)" }}>{e.t}</div>
                  <div
                    className="mono"
                    style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 2 }}
                  >
                    {e.meta} · {e.ts}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              Risk factors
            </div>
            {RISK_FACTORS.map((r, i) => (
              <div
                key={`m-${r.n}`}
                style={{
                  padding: "10px 0",
                  borderBottom:
                    i < RISK_FACTORS.length - 1 ? "1px dashed var(--line)" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                    fontSize: 12,
                  }}
                >
                  <span>{r.n}</span>
                  <span className="mono" style={{ color: "var(--text-1)" }}>
                    {r.v}/100
                  </span>
                </div>
                <RiskBar value={r.v} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
