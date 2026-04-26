import Link from "next/link";
import {
  Icons,
  Monogram,
  ThemeToggle,
  YieldTape,
  HeroChart,
  TokenGlyph,
  ChainGlyph,
  Spark,
  MobileTab,
} from "@/components/sovereign";
import { walk } from "@/lib/demo-data";

/* ------------------------------------------------------------------ */
/*  Real product surface — every card maps to a working route        */
/* ------------------------------------------------------------------ */

const PRODUCT = [
  {
    k: "01",
    n: "Discover",
    d: "Thousands of pools. One view of the ones worth your time. Sorted by what actually survives — not by whoever paid for the listing.",
    cta: "Open Discover",
    href: "/discover",
    icon: Icons.search,
    accent: false,
  },
  {
    k: "02",
    n: "Strategist",
    d: "A full portfolio, written to your budget and your risk. Stress-tested, defended, and revised before it reaches you. Not one opinion. A verdict.",
    cta: "Build a portfolio",
    href: "/strategies",
    icon: Icons.brain,
    accent: true,
  },
  {
    k: "03",
    n: "Audit",
    d: "Paste any contract. Get back a plain-English verdict mapped to the open security standard. The kind of report you'd hand to a CFO.",
    cta: "Run an audit",
    href: "/security/audit",
    icon: Icons.shield,
    accent: false,
  },
  {
    k: "04",
    n: "Model",
    d: "Replay any allocation through depegs, drains, and drawdowns before you commit a dollar. See how diversified you really are — not how diversified you feel.",
    cta: "Open Model",
    href: "/tools",
    icon: Icons.activity,
    accent: false,
  },
  {
    k: "05",
    n: "Watch",
    d: "Drains. Depegs. Quiet governance moves. Flagged the moment they happen — not after they trend on Twitter.",
    cta: "Open Watch",
    href: "/portfolio",
    icon: Icons.bell,
    accent: false,
  },
] as const;

const ARCH_LAYERS = [
  {
    k: "L1",
    n: "The facts",
    s: "Verifiable. Never opinions.",
    items: [
      "Live pool depth and pricing",
      "Verified deployer history",
      "Oracle feed integrity",
      "Active bounty coverage",
      "On-chain incident record",
    ],
    note: "Every number traces to a primary source. Click through and verify the work.",
    icon: Icons.globe,
  },
  {
    k: "L2",
    n: "The verdict",
    s: "Reasoned. Reconciled. Defended.",
    items: [
      "Independent reasoning, in parallel",
      "Each conclusion is challenged",
      "The most conservative read wins",
      "Disagreements surfaced — never hidden",
      "Resilient to a single point of failure",
    ],
    note: "When the analysis disagrees with itself, you see the disagreement.",
    icon: Icons.brain,
  },
  {
    k: "L3",
    n: "The floor",
    s: "Rules that overrule everyone.",
    items: [
      "Recent exploit — score capped",
      "TVL collapse — score capped",
      "Untrusted deployer — score capped",
      "Failed audit posture — score capped",
      "Broken audit trail — score capped",
    ],
    note: "Deterministic. Auditable. Nothing talks the floor down.",
    icon: Icons.lock,
  },
] as const;

const AUDIT_ENGINES = [
  { n: "Static review", d: "What the code says it does." },
  { n: "Pattern review", d: "What the code looks like, line for line." },
  { n: "Path review", d: "What the code can be made to do." },
  { n: "Live state", d: "Who actually controls it, right now." },
] as const;

const TRUST = [
  {
    n: "You hold the keys.",
    d: "We never custody. We never approve. We never sign. Your wallet stays yours — and that's not policy, it's the architecture.",
    icon: Icons.lock,
  },
  {
    n: "Show your work.",
    d: "Every number you see traces to a public source. No proprietary indexes. No opinion sold as data. Click through and check anything.",
    icon: Icons.eye,
  },
  {
    n: "Always current.",
    d: "Pools re-priced every minute. History reseeded continuously. Your positions watched without pause. Stale data is treated as a failure.",
    icon: Icons.refresh,
  },
] as const;

const TAPE_PREVIEW_FALLBACK = [
  { pool: "sDAI", protocol: "Spark", chain: "eth" as const, apy: 8.75, d: 0.31 },
  { pool: "USDC", protocol: "Aave v3", chain: "eth" as const, apy: 5.14, d: 0.12 },
  { pool: "stETH", protocol: "Lido", chain: "eth" as const, apy: 3.22, d: -0.04 },
  { pool: "USDC", protocol: "Morpho", chain: "base" as const, apy: 6.41, d: 0.18 },
  { pool: "GHO", protocol: "Aave v3", chain: "arb" as const, apy: 7.2, d: -0.15 },
];

/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const mobileChart = walk(7, 40, 100, 2.2);

  return (
    <>
      {/* ============================================================ */}
      {/*  DESKTOP                                                     */}
      {/* ============================================================ */}
      <div
        className="desktop-only"
        style={{
          background: "var(--bg)",
          minHeight: "100vh",
          position: "relative",
          overflowX: "hidden",
        }}
      >
        {/* Ambient orbs */}
        <div
          className="orb"
          style={{
            top: -120,
            left: -140,
            width: 460,
            height: 460,
            background: "color-mix(in oklch, var(--accent) 30%, transparent)",
          }}
        />
        <div
          className="orb"
          style={{
            top: 60,
            right: -140,
            width: 380,
            height: 380,
            background: "color-mix(in oklch, var(--text) 8%, transparent)",
            opacity: 0.5,
          }}
        />

        {/* ---------------- NAV ---------------- */}
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
            <Monogram size={44} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.08 }}>
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em" }}>
                Sovereign
              </span>
              <span
                className="mono"
                style={{ fontSize: 9.5, color: "var(--text-dim)", letterSpacing: "0.12em", marginTop: 2 }}
              >
                INVESTMENT GROUP
              </span>
            </div>
          </Link>

          <div
            className="landing-pills hide-lt-1100"
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
              { l: "Strategist", h: "/strategies" },
              { l: "Audit", h: "/security/audit" },
              { l: "Tools", h: "/tools" },
              { l: "Method", h: "#method" },
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

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ThemeToggle />
            <Link className="btn btn-sm btn-ghost" href="#method">
              How it works
            </Link>
            <Link className="btn btn-primary btn-sm" href="/discover">
              Open app <Icons.arrow size={13} />
            </Link>
          </div>
        </nav>

        {/* ---------------- HERO ---------------- */}
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
              gridTemplateColumns: "1.05fr 1fr",
              gap: 64,
              alignItems: "center",
            }}
          >
            <div className="fadeUp">
              <span
                className="chip accent mono"
                style={{ marginBottom: 28, display: "inline-flex" }}
              >
                <span className="dot accent pulse-dot" /> OPEN · LIVE · WATCHING
              </span>
              <h1
                className="display"
                style={{
                  fontSize: "clamp(44px, 6vw, 78px)",
                  fontWeight: 600,
                  lineHeight: 0.96,
                  letterSpacing: "-0.04em",
                  margin: "0 0 22px",
                  textWrap: "balance",
                }}
              >
                Yield,
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
                  with conviction.
                </span>
              </h1>
              <p
                style={{
                  fontSize: 18,
                  lineHeight: 1.55,
                  color: "var(--text-2)",
                  maxWidth: 540,
                  margin: "0 0 32px",
                }}
              >
                The DeFi yield surface is loud, fast, and unforgiving. We make it quiet.
                You see only what survives the stress test — and never deposit a dollar
                that hasn&rsquo;t already been defended.
              </p>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <Link className="btn btn-primary btn-lg" href="/discover">
                  Open the terminal <Icons.arrow size={14} />
                </Link>
                <Link className="btn btn-lg" href="#method">
                  How it works
                </Link>
                <span style={{ fontSize: 12.5, color: "var(--text-dim)", marginLeft: 4 }}>
                  No wallet needed to look around.
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
                <span className="eyebrow">QUIETLY, IN THE BACKGROUND</span>
                <div style={{ height: 1, flex: "0 0 20px", background: "var(--line)" }} />
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-2)",
                    display: "flex",
                    gap: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <span>Continuously re-priced</span>
                  <span style={{ color: "var(--line-2)" }}>/</span>
                  <span>Continuously re-checked</span>
                  <span style={{ color: "var(--line-2)" }}>/</span>
                  <span>Continuously watching</span>
                </span>
              </div>
            </div>

            <div className="fadeUp" style={{ position: "relative", paddingBottom: 28, animationDelay: "120ms" }}>
              <div style={{ position: "relative", zIndex: 2 }}>
                <HeroChart />
              </div>

              <Link
                href="/security/audit"
                style={{
                  marginTop: 16,
                  padding: "10px 14px",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  boxShadow: "var(--shadow-sm)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  textDecoration: "none",
                  color: "inherit",
                  zIndex: 1,
                  position: "relative",
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
                  <span style={{ color: "var(--text)", fontWeight: 500 }}>
                    The receipts
                  </span>
                  <br />
                  Every exploit. Every bounty. On the record.
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* ---------------- LIVE TAPE ---------------- */}
        <YieldTape />

        {/* ---------------- THE PROBLEM ---------------- */}
        <section
          style={{
            padding: "96px 48px 0",
            maxWidth: 1340,
            margin: "0 auto",
          }}
        >
          <div
            className="fadeUp"
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 64,
              alignItems: "end",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="eyebrow">WHY WE BUILT THIS</div>
              <h2
                className="display"
                style={{
                  fontSize: "clamp(30px, 4vw, 46px)",
                  margin: "12px 0 0",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.05,
                  textWrap: "balance",
                }}
              >
                Every dashboard shows you a number.{" "}
                <span style={{ color: "var(--text-dim)" }}>
                  None of them tell you whether it survives the night.
                </span>
              </h2>
            </div>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>
              We treat every pool as guilty until proven safe. The contracts, the
              custody, the oracles, the capital — all defended on your behalf, before
              you size the trade and long after.
            </p>
          </div>
        </section>

        {/* ---------------- THE PRODUCT ---------------- */}
        <section
          style={{
            padding: "44px 48px 80px",
            maxWidth: 1340,
            margin: "0 auto",
          }}
        >
          <div
            className="landing-tools-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 18,
            }}
          >
            {PRODUCT.map((c, i) => {
              const Ic = c.icon;
              return (
                <Link
                  key={c.k}
                  href={c.href}
                  className="fadeUp landing-product-card"
                  style={{
                    padding: 26,
                    background: c.accent ? "var(--text)" : "var(--surface)",
                    color: c.accent ? "var(--bg)" : "var(--text)",
                    border: "1px solid " + (c.accent ? "var(--text)" : "var(--line)"),
                    borderRadius: 18,
                    boxShadow: c.accent ? "var(--shadow-md)" : "var(--shadow-xs)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    minHeight: 240,
                    position: "relative",
                    overflow: "hidden",
                    textDecoration: "none",
                    animationDelay: `${i * 70}ms`,
                    transition: "transform .25s ease, box-shadow .25s ease",
                  }}
                >
                  {c.accent ? (
                    <span
                      style={{
                        position: "absolute",
                        top: -40,
                        right: -40,
                        width: 200,
                        height: 200,
                        borderRadius: "50%",
                        background: "color-mix(in oklch, var(--accent) 42%, transparent)",
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
                        width: 42,
                        height: 42,
                        borderRadius: 11,
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
                      <Ic size={19} />
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
                      {c.k} / 05
                    </span>
                  </div>
                  <div
                    className="display"
                    style={{
                      fontSize: 24,
                      fontWeight: 600,
                      letterSpacing: "-0.022em",
                      position: "relative",
                    }}
                  >
                    {c.n}
                  </div>
                  <p
                    style={{
                      fontSize: 13.5,
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

        {/* ---------------- THE MOAT (METHOD) ---------------- */}
        <section
          id="method"
          style={{
            padding: "32px 48px 96px",
            maxWidth: 1340,
            margin: "0 auto",
          }}
        >
          <div
            className="fadeUp"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 36,
              gap: 32,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 720 }}>
              <div className="eyebrow">HOW IT WORKS</div>
              <h2
                className="display"
                style={{
                  fontSize: "clamp(32px, 4.2vw, 50px)",
                  margin: "12px 0 0",
                  letterSpacing: "-0.035em",
                  lineHeight: 1.02,
                  textWrap: "balance",
                }}
              >
                Three layers.{" "}
                <span style={{ color: "var(--text-dim)" }}>
                  Nothing hidden behind any of them.
                </span>
              </h2>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-2)", maxWidth: 360, lineHeight: 1.55, margin: 0 }}>
              The facts arrive verifiable. The reasoning arrives reconciled. And a
              safety floor, written in rules, overrules anything that drifts.
            </p>
          </div>

          <div
            className="landing-arch-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 18,
              position: "relative",
            }}
          >
            {ARCH_LAYERS.map((layer, i) => {
              const Ic = layer.icon;
              return (
                <div
                  key={layer.k}
                  className="fadeUp"
                  style={{
                    padding: 28,
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 18,
                    boxShadow: "var(--shadow-xs)",
                    position: "relative",
                    overflow: "hidden",
                    minHeight: 360,
                    display: "flex",
                    flexDirection: "column",
                    animationDelay: `${i * 90}ms`,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: -60,
                      left: -60,
                      width: 180,
                      height: 180,
                      borderRadius: "50%",
                      background: "color-mix(in oklch, var(--accent) 12%, transparent)",
                      filter: "blur(50px)",
                      pointerEvents: "none",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 18,
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid color-mix(in oklch, var(--accent) 28%, transparent)",
                      }}
                    >
                      <Ic size={20} />
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)",
                        letterSpacing: "0.08em",
                      }}
                    >
                      LAYER · {layer.k}
                    </span>
                  </div>
                  <div
                    className="display"
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      marginBottom: 4,
                      position: "relative",
                    }}
                  >
                    {layer.n}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-dim)",
                      marginBottom: 18,
                      position: "relative",
                    }}
                  >
                    {layer.s}
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      flex: 1,
                      position: "relative",
                    }}
                  >
                    {layer.items.map((it) => (
                      <li
                        key={it}
                        style={{
                          fontSize: 12.5,
                          color: "var(--text-2)",
                          lineHeight: 1.5,
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                        }}
                      >
                        <Icons.check
                          size={13}
                          style={{ color: "var(--accent)", marginTop: 3, flexShrink: 0 }}
                        />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                  <div
                    style={{
                      marginTop: 18,
                      paddingTop: 14,
                      borderTop: "1px dashed var(--line)",
                      fontSize: 11.5,
                      color: "var(--text-dim)",
                      lineHeight: 1.5,
                      position: "relative",
                    }}
                  >
                    {layer.note}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------------- AUDIT SPOTLIGHT ---------------- */}
        <section style={{ padding: "0 48px 96px", maxWidth: 1340, margin: "0 auto" }}>
          <div
            className="fadeUp"
            style={{
              padding: 48,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 22,
              boxShadow: "var(--shadow-sm)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -100,
                right: -100,
                width: 320,
                height: 320,
                borderRadius: "50%",
                background: "color-mix(in oklch, var(--accent) 14%, transparent)",
                filter: "blur(70px)",
                pointerEvents: "none",
              }}
            />

            <div
              className="landing-method-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.45fr",
                gap: 56,
                alignItems: "start",
                position: "relative",
              }}
            >
              <div>
                <span className="chip accent mono" style={{ marginBottom: 16 }}>
                  <Icons.shield size={11} /> CONTRACT AUDIT
                </span>
                <h3
                  className="display"
                  style={{
                    fontSize: "clamp(28px, 3.4vw, 38px)",
                    margin: "12px 0 16px",
                    letterSpacing: "-0.03em",
                    lineHeight: 1.05,
                  }}
                >
                  Paste an address.
                  <br />
                  Get an answer.
                </h3>
                <p
                  style={{
                    fontSize: 14.5,
                    color: "var(--text-2)",
                    lineHeight: 1.6,
                    margin: "0 0 22px",
                  }}
                >
                  We read the source. We probe the live state. We exhaust every path the
                  code can be pushed down. The verdict comes back in plain English —
                  mapped to the open security standard, written for the human reading it.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link className="btn btn-primary" href="/security/audit">
                    Run an audit <Icons.arrow size={13} />
                  </Link>
                  <span
                    className="chip mono"
                    style={{ fontSize: 10.5 }}
                  >
                    OPEN SECURITY STANDARD
                  </span>
                </div>
              </div>

              <div
                className="landing-method-axes"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 1,
                  background: "var(--line)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                {AUDIT_ENGINES.map((e) => (
                  <div
                    key={e.n}
                    style={{ background: "var(--surface)", padding: 20, minHeight: 130 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 14,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {e.n}
                      </span>
                      <Icons.terminal size={14} style={{ color: "var(--accent)" }} />
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-dim)",
                        lineHeight: 1.5,
                      }}
                    >
                      {e.d}
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    background: "var(--surface)",
                    padding: 20,
                    minHeight: 130,
                    gridColumn: "1 / -1",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Icons.brain size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                      The verdict, in plain English.
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>
                      Every finding is grounded in real evidence. Nothing is invented.
                      Nothing is editorialised. You read what the code actually does.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- TRUST STRIP ---------------- */}
        <section style={{ padding: "0 48px 96px", maxWidth: 1340, margin: "0 auto" }}>
          <div
            className="landing-tools-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}
          >
            {TRUST.map((t, i) => {
              const Ic = t.icon;
              return (
                <div
                  key={t.n}
                  className="fadeUp"
                  style={{
                    padding: 24,
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 16,
                    boxShadow: "var(--shadow-xs)",
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      flexShrink: 0,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid color-mix(in oklch, var(--accent) 28%, transparent)",
                    }}
                  >
                    <Ic size={17} />
                  </span>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>
                      {t.n}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55 }}>
                      {t.d}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------------- FINAL CTA ---------------- */}
        <section style={{ padding: "0 48px 96px", maxWidth: 1340, margin: "0 auto" }}>
          <div
            className="fadeUp"
            style={{
              position: "relative",
              padding: "56px 48px",
              background:
                "linear-gradient(135deg, var(--surface) 0%, color-mix(in oklch, var(--accent) 8%, var(--surface)) 100%)",
              border: "1px solid var(--line)",
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "var(--shadow-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 32,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -120,
                right: -80,
                width: 360,
                height: 360,
                borderRadius: "50%",
                background: "color-mix(in oklch, var(--accent) 22%, transparent)",
                filter: "blur(80px)",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative", maxWidth: 620 }}>
              <span className="chip mono" style={{ marginBottom: 14 }}>
                <span className="dot accent pulse-dot" /> READY WHEN YOU ARE
              </span>
              <h2
                className="display"
                style={{
                  fontSize: "clamp(30px, 4vw, 44px)",
                  margin: "8px 0 14px",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.05,
                  textWrap: "balance",
                }}
              >
                The terminal is open.{" "}
                <span style={{ color: "var(--text-dim)" }}>The yield is ready.</span>
              </h2>
              <p style={{ fontSize: 14.5, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>
                Look around the survivors. Audit a contract. Compose a portfolio. We only
                ask for your wallet when you&rsquo;re ready to track what&rsquo;s already
                yours.
              </p>
            </div>
            <div
              style={{
                position: "relative",
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <Link className="btn btn-primary btn-lg" href="/discover">
                Open the terminal <Icons.arrow size={14} />
              </Link>
              <Link className="btn btn-lg" href="/strategies">
                Compose a portfolio
              </Link>
            </div>
          </div>
        </section>

        {/* ---------------- FOOTER ---------------- */}
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
              <Monogram size={34} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 12.5, color: "var(--text-1)", fontWeight: 500 }}>
                  Sovereign Investment Group · 2026
                </span>
                <span>Read-only. Not financial advice. Move with care.</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 24, fontSize: 13, color: "var(--text-2)" }}>
              <Link href="#method" style={{ color: "inherit", textDecoration: "none" }}>
                Method
              </Link>
              <Link href="/discover" style={{ color: "inherit", textDecoration: "none" }}>
                Discover
              </Link>
              <Link href="/security/audit" style={{ color: "inherit", textDecoration: "none" }}>
                Audit
              </Link>
              <Link href="/strategies" style={{ color: "inherit", textDecoration: "none" }}>
                Strategist
              </Link>
            </div>
          </div>
        </footer>
      </div>

      {/* ============================================================ */}
      {/*  MOBILE                                                      */}
      {/* ============================================================ */}
      <div className="mobile-only" style={{ paddingBottom: 76 }}>
        <div className="m-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Monogram size={32} />
            <div>
              <div className="m-title" style={{ fontSize: 18 }}>
                Sovereign
              </div>
              <div className="m-sub">INVESTMENT GROUP</div>
            </div>
          </div>
          <ThemeToggle variant="mobile" />
        </div>

        <div className="m-content">
          {/* HERO */}
          <div
            className="card-raised fadeUp"
            style={{ padding: 18, position: "relative", overflow: "hidden" }}
          >
            <span className="chip accent mono" style={{ marginBottom: 14 }}>
              <span className="dot accent pulse-dot" /> OPEN · LIVE · WATCHING
            </span>
            <h1
              className="display"
              style={{
                fontSize: 30,
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                margin: "0 0 10px",
              }}
            >
              Yield,
              <br />
              <span style={{ fontStyle: "italic", fontWeight: 500, color: "var(--accent)" }}>
                with conviction.
              </span>
            </h1>
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--text-2)",
                margin: "0 0 16px",
              }}
            >
              The DeFi yield surface is loud, fast, and unforgiving. We make it quiet —
              so you only ever see what survives.
            </p>
            <div style={{ height: 48, margin: "4px 0 14px", opacity: 0.75 }}>
              <Spark data={mobileChart} stroke="var(--accent)" height={48} fill />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Link href="/discover" className="btn btn-primary btn-sm">
                Open the terminal
              </Link>
              <Link href="#method" className="btn btn-sm">
                How it works
              </Link>
            </div>
          </div>

          {/* LIVE TAPE PREVIEW */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="dot good pulse-dot" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>The survivors, today</span>
              </div>
              <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>
                TOP 5
              </span>
            </div>
            {TAPE_PREVIEW_FALLBACK.map((r, i) => (
              <div
                key={`${r.pool}-${i}`}
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderBottom:
                    i < TAPE_PREVIEW_FALLBACK.length - 1
                      ? "1px solid var(--line)"
                      : "none",
                }}
              >
                <TokenGlyph sym={r.pool} size={28} />
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.pool}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    {r.protocol}
                  </div>
                </div>
                <ChainGlyph id={r.chain} size={16} label={false} />
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontSize: 13, fontWeight: 500 }}>
                    {r.apy.toFixed(2)}%
                  </div>
                  <div
                    className={r.d >= 0 ? "delta-up" : "delta-dn"}
                    style={{ fontSize: 10, justifyContent: "flex-end" }}
                  >
                    {r.d >= 0 ? "▲" : "▼"} {Math.abs(r.d).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* PRODUCT */}
          <div className="card" style={{ padding: 14 }}>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
              THE TERMINAL
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {PRODUCT.map((t) => {
                const Ic = t.icon;
                return (
                  <Link
                    key={t.k}
                    href={t.href}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        flexShrink: 0,
                        background: t.accent ? "var(--accent-soft)" : "var(--surface-3)",
                        color: t.accent ? "var(--accent)" : "var(--text-1)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <Ic size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.n}</div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-dim)",
                          lineHeight: 1.5,
                          marginTop: 2,
                        }}
                      >
                        {t.d}
                      </div>
                    </div>
                    <Icons.chevR
                      size={14}
                      style={{ color: "var(--text-dim)", marginTop: 10 }}
                    />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* MOAT (mobile compact) */}
          <div id="method" className="card" style={{ padding: 14 }}>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
              HOW IT WORKS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {ARCH_LAYERS.map((layer) => {
                const Ic = layer.icon;
                return (
                  <div key={layer.k} style={{ display: "flex", gap: 12 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        flexShrink: 0,
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid color-mix(in oklch, var(--accent) 28%, transparent)",
                      }}
                    >
                      <Ic size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {layer.k} · {layer.n}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-dim)",
                          lineHeight: 1.5,
                          marginTop: 2,
                        }}
                      >
                        {layer.s}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TRUST */}
          <div className="card" style={{ padding: 14 }}>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
              THE PROMISES
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {TRUST.map((t) => {
                const Ic = t.icon;
                return (
                  <div key={t.n} style={{ display: "flex", gap: 12 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        flexShrink: 0,
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid color-mix(in oklch, var(--accent) 28%, transparent)",
                      }}
                    >
                      <Ic size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.n}</div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-dim)",
                          lineHeight: 1.5,
                          marginTop: 2,
                        }}
                      >
                        {t.d}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FINAL CTA */}
          <div
            className="card"
            style={{
              padding: 16,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>The terminal is open.</div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-dim)",
                lineHeight: 1.5,
                maxWidth: 320,
              }}
            >
              Read-only. We never touch your funds. Connect a wallet only when you want
              to watch what&rsquo;s already yours.
            </div>
            <Link href="/discover" className="btn btn-primary btn-sm">
              Step inside
            </Link>
          </div>
        </div>

        <MobileTab />
      </div>
    </>
  );
}
