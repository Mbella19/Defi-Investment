import Link from "next/link";
import {
  Icons,
  Monogram,
  YieldTape,
  HeroChart,
  TokenGlyph,
} from "@/components/sovereign";

const TOOLS = [
  {
    k: "01",
    n: "Scan",
    d: "Filter thousands of pools by chain, token, TVL floor, and risk band. Sort by APY, safety, or TVL half-life.",
    cta: "Open Scanner",
    href: "/discover",
    accent: false,
    icon: Icons.search,
  },
  {
    k: "02",
    n: "Score",
    d: "A transparent 0–100 score per protocol across six axes. Every component is sourced, dated, and appealable.",
    cta: "View Methodology",
    href: "#method",
    accent: true,
    icon: Icons.shield,
  },
  {
    k: "03",
    n: "Monitor",
    d: "Watch positions and a watchlist in real time. Alerts fire on APY drops, TVL exodus, governance moves, or incidents.",
    cta: "See Monitor",
    href: "/portfolio",
    accent: false,
    icon: Icons.activity,
  },
] as const;

const AXES = [
  { n: "Code", s: "Etherscan, GitHub", w: 22 },
  { n: "Audits", s: "Direct disclosure", w: 18 },
  { n: "Oracles", s: "Chainlink, Pyth registries", w: 15 },
  { n: "Governance", s: "On-chain timelock, multisig", w: 15 },
  { n: "Liquidity", s: "TVL half-life", w: 15 },
  { n: "History", s: "Immunefi, REKT", w: 15 },
];

export default function LandingPage() {
  return (
    <div
      style={{
        background: "var(--bg)",
        minHeight: "100vh",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <div
        className="orb"
        style={{
          top: -120,
          left: -140,
          width: 420,
          height: 420,
          background: "color-mix(in oklch, var(--accent) 32%, transparent)",
        }}
      />
      <div
        className="orb"
        style={{
          top: 40,
          right: -120,
          width: 380,
          height: 380,
          background: "color-mix(in oklch, var(--text) 8%, transparent)",
          opacity: 0.5,
        }}
      />

      <nav
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 48px",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            color: "var(--text)",
          }}
        >
          <Monogram size={34} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.08 }}>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em" }}>Sovereign</span>
            <span
              className="mono"
              style={{ fontSize: 9.5, color: "var(--text-dim)", letterSpacing: "0.12em", marginTop: 2 }}
            >
              INVESTMENT GROUP
            </span>
          </div>
        </Link>

        <div
          className="landing-pills"
          style={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            padding: 5,
            background: "var(--glass-bg)",
            backdropFilter: "blur(var(--glass-blur))",
            WebkitBackdropFilter: "blur(var(--glass-blur))",
            borderRadius: 999,
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          {[
            { l: "Discover", h: "/discover" },
            { l: "Portfolio", h: "/portfolio" },
            { l: "Security", h: "/security" },
            { l: "Method", h: "#method" },
            { l: "Tools", h: "/tools" },
          ].map((n) => (
            <Link
              key={n.l}
              href={n.h}
              style={{
                padding: "7px 14px",
                fontSize: 13,
                color: "var(--text-2)",
                borderRadius: 999,
                fontWeight: 450,
                textDecoration: "none",
              }}
            >
              {n.l}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn btn-sm btn-ghost" href="/discover">
            Sign in
          </Link>
          <Link className="btn btn-primary btn-sm" href="/discover">
            Open app <Icons.arrow size={13} />
          </Link>
        </div>
      </nav>

      <section
        style={{
          position: "relative",
          padding: "56px 48px 48px",
          maxWidth: 1340,
          margin: "0 auto",
        }}
      >
        <div
          className="landing-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.08fr 1fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          <div>
            <span
              className="chip accent mono"
              style={{ marginBottom: 28, display: "inline-flex" }}
            >
              <span className="dot accent pulse-dot" /> LIVE · 9 POOLS ON THE TAPE
            </span>
            <h1
              className="display"
              style={{
                fontSize: "clamp(44px, 6vw, 76px)",
                fontWeight: 600,
                lineHeight: 0.96,
                letterSpacing: "-0.04em",
                margin: "0 0 22px",
                textWrap: "balance",
              }}
            >
              On-chain yield,
              <br />
              <span
                style={{
                  fontStyle: "italic",
                  fontWeight: 500,
                  color: "var(--text)",
                  background:
                    "linear-gradient(180deg, var(--text) 60%, var(--accent) 60%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                }}
              >
                priced honestly.
              </span>
            </h1>
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.5,
                color: "var(--text-2)",
                maxWidth: 520,
                margin: "0 0 32px",
              }}
            >
              SIG scores every DeFi pool on live TVL, audit posture, oracle health, and capital
              stickiness — so you can size risk before you size a position.
            </p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Link className="btn btn-primary btn-lg" href="/discover">
                Scan for yield <Icons.arrow size={14} />
              </Link>
              <Link className="btn btn-lg" href="#method">
                Read the method
              </Link>
              <span style={{ fontSize: 12.5, color: "var(--text-dim)", marginLeft: 4 }}>
                No wallet required to browse.
              </span>
            </div>

            <div
              style={{
                marginTop: 40,
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <span className="eyebrow">SOURCES</span>
              <div style={{ height: 1, flex: "0 0 20px", background: "var(--line)" }} />
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <span>DeFiLlama</span>
                <span style={{ color: "var(--line-2)" }}>/</span>
                <span>Etherscan</span>
                <span style={{ color: "var(--line-2)" }}>/</span>
                <span>Chainlink</span>
                <span style={{ color: "var(--line-2)" }}>/</span>
                <span>Immunefi</span>
                <span style={{ color: "var(--line-2)" }}>/</span>
                <span>REKT</span>
              </span>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <div
              className="landing-hero-card-peek"
              style={{
                position: "absolute",
                top: 36,
                right: -18,
                width: 280,
                padding: 16,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 18,
                boxShadow: "var(--shadow-sm)",
                transform: "rotate(3deg)",
                zIndex: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <TokenGlyph sym="sDAI" size={26} tone="accent" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>sDAI</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Spark · Ethereum</div>
                </div>
                <span className="chip good mono" style={{ marginLeft: "auto", fontSize: 10 }}>
                  A+ 90
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 4,
                }}
              >
                <span className="eyebrow" style={{ fontSize: 9.5 }}>APY</span>
                <span className="num" style={{ fontSize: 20, fontWeight: 500 }}>8.75%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="eyebrow" style={{ fontSize: 9.5 }}>TVL</span>
                <span className="num" style={{ fontSize: 13, color: "var(--text-1)" }}>$1.42B</span>
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
              <HeroChart />
            </div>

            <div
              style={{
                position: "absolute",
                bottom: -20,
                left: -20,
                padding: "10px 14px",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                boxShadow: "var(--shadow-sm)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                maxWidth: 240,
                zIndex: 2,
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icons.shield size={15} />
              </span>
              <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.35 }}>
                <span style={{ color: "var(--text)", fontWeight: 500 }}>127 incidents</span> logged
                <br />
                and linked to source
              </div>
            </div>
          </div>
        </div>
      </section>

      <YieldTape />

      <section
        style={{
          padding: "96px 48px 72px",
          maxWidth: 1340,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 40,
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow">WHAT IT DOES</div>
            <h2
              className="display"
              style={{
                fontSize: "clamp(32px, 4.2vw, 48px)",
                margin: "12px 0 0",
                letterSpacing: "-0.035em",
                lineHeight: 1.02,
                textWrap: "balance",
              }}
            >
              Three tools.{" "}
              <span style={{ color: "var(--text-dim)" }}>One source of truth.</span>
            </h2>
          </div>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-2)",
              maxWidth: 340,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Every score, chart, and alert links back to its primary source. No vibes, no fake
            leaderboards, no made-up partnerships.
          </p>
        </div>

        <div
          className="landing-tools-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
        >
          {TOOLS.map((c) => {
            const Ic = c.icon;
            return (
              <Link
                key={c.k}
                href={c.href}
                style={{
                  padding: 28,
                  background: c.accent ? "var(--text)" : "var(--surface)",
                  color: c.accent ? "var(--bg)" : "var(--text)",
                  border: "1px solid " + (c.accent ? "var(--text)" : "var(--line)"),
                  borderRadius: 20,
                  boxShadow: c.accent ? "var(--shadow-md)" : "var(--shadow-xs)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  minHeight: 260,
                  position: "relative",
                  overflow: "hidden",
                  textDecoration: "none",
                }}
              >
                {c.accent ? (
                  <span
                    style={{
                      position: "absolute",
                      top: -40,
                      right: -40,
                      width: 180,
                      height: 180,
                      borderRadius: "50%",
                      background: "color-mix(in oklch, var(--accent) 40%, transparent)",
                      filter: "blur(40px)",
                    }}
                  />
                ) : null}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: c.accent ? "var(--accent)" : "var(--accent-soft)",
                      color: c.accent ? "var(--accent-ink)" : "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: c.accent
                        ? "0"
                        : "1px solid color-mix(in oklch, var(--accent) 28%, transparent)",
                    }}
                  >
                    <Ic size={20} />
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: c.accent
                        ? "color-mix(in oklch, var(--bg) 60%, transparent)"
                        : "var(--text-dim)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {c.k} / 03
                  </span>
                </div>
                <div
                  className="display"
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    letterSpacing: "-0.025em",
                    position: "relative",
                  }}
                >
                  {c.n}
                </div>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.55,
                    margin: 0,
                    flex: 1,
                    position: "relative",
                    color: c.accent
                      ? "color-mix(in oklch, var(--bg) 72%, transparent)"
                      : "var(--text-2)",
                  }}
                >
                  {c.d}
                </p>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: c.accent ? "var(--accent)" : "var(--text)",
                    display: "inline-flex",
                    gap: 7,
                    alignItems: "center",
                    position: "relative",
                  }}
                >
                  {c.cta} <Icons.arrow size={13} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section
        id="method"
        style={{ padding: "24px 48px 80px", maxWidth: 1340, margin: "0 auto" }}
      >
        <div
          style={{
            padding: 48,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 24,
            boxShadow: "var(--shadow-sm)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: -80,
              right: -80,
              width: 300,
              height: 300,
              borderRadius: "50%",
              background: "color-mix(in oklch, var(--accent) 14%, transparent)",
              filter: "blur(60px)",
              pointerEvents: "none",
            }}
          />
          <div
            className="landing-method-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.7fr",
              gap: 56,
              alignItems: "start",
              position: "relative",
            }}
          >
            <div>
              <div className="eyebrow">HOW SCORING WORKS</div>
              <h3
                className="display"
                style={{
                  fontSize: "clamp(28px, 3.2vw, 36px)",
                  margin: "12px 0 18px",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.05,
                }}
              >
                Six axes.
                <br />
                All sourced.
                <br />
                All public.
              </h3>
              <p style={{ fontSize: 14.5, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 22px" }}>
                SIG doesn&rsquo;t hide behind a proprietary black box. Every component of a
                protocol&rsquo;s score links to its primary source — Etherscan verification,
                Immunefi programs, on-chain governance contracts, Chainlink feed registries.
              </p>
              <Link className="btn" href="/security">
                Read full methodology <Icons.external size={13} />
              </Link>
            </div>

            <div
              className="landing-method-axes"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1,
                background: "var(--line)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {AXES.map((a) => (
                <div key={a.n} style={{ background: "var(--surface)", padding: 22, minHeight: 140 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 16,
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
                      {a.n}
                    </span>
                    <span className="chip mono" style={{ fontSize: 10 }}>
                      {a.w}%
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>
                    {a.s}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "36px 48px",
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            maxWidth: 1340,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 12,
              color: "var(--text-dim)",
            }}
          >
            <Monogram size={26} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-1)", fontWeight: 500 }}>
                Sovereign Investment Group · 2026
              </span>
              <span>Not financial advice. DeFi is experimental.</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 13, color: "var(--text-2)" }}>
            <span>Docs</span>
            <span>Method</span>
            <span>Status</span>
            <span>GitHub</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
