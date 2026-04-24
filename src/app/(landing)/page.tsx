import Link from "next/link";
import { Eyebrow, Icons } from "@/components/sovereign";
import OrbitalHero from "@/components/landing/OrbitalHero";
import LandingTicker from "@/components/landing/LandingTicker";

const EVIDENCE = [
  { n: "AUDITS", v: "6", d: "OpenZeppelin, Trail of Bits, Certora." },
  { n: "TEAM", v: "KYC", d: "Doxxed founders, public ownership." },
  { n: "TVL HALF-LIFE", v: "427d", d: "Capital stickiness vs. mercenary TVL." },
  { n: "EXPLOITS", v: "0", d: "Post-mortems of historical incidents." },
  { n: "GOVERNANCE", v: "ON-CHAIN", d: "Time-locked multisig, public votes." },
  { n: "ORACLE", v: "CHAINLINK", d: "Primary and fallback feed analysis." },
];

const SUITE = [
  {
    k: "01",
    n: "Auto-Strategist",
    d: "Specify budget, risk, APY band. Receive an allocation grounded in live analysis.",
    href: "/strategy",
  },
  {
    k: "02",
    n: "Vault Explorer",
    d: "Ten thousand pools filtered by safety, chain, token, term.",
    href: "/results",
  },
  {
    k: "03",
    n: "Portfolio",
    d: "Unified view of active sleeves, rebalance windows, projected yield curves.",
    href: "/portfolio",
  },
  {
    k: "04",
    n: "Risk Lab",
    d: "VaR, Sharpe, stress tests, correlation matrices. Quantitative clarity.",
    href: "/risk",
  },
  {
    k: "05",
    n: "Live Monitor",
    d: "APY shifts, TVL guardrails, exploit feeds. Action before headlines.",
    href: "/monitor",
  },
  {
    k: "06",
    n: "Comparator",
    d: "Three strategies, three risk profiles, side by side.",
    href: "/compare",
  },
];

const STATS = [
  ["10,420", "POOLS INDEXED"],
  ["$42.8B", "TVL TRACKED"],
  ["3,104", "DEEP ANALYSES"],
  ["92 / 100", "AVG SAFETY"],
] as const;

const FOOTER_COLUMNS: Array<[string, Array<[string, string]>]> = [
  [
    "PLATFORM",
    [
      ["Strategy", "/strategy"],
      ["Vaults", "/results"],
      ["Portfolio", "/portfolio"],
      ["Risk Lab", "/risk"],
    ],
  ],
  [
    "DATA",
    [
      ["DeFiLlama", "#"],
      ["Chainlink", "#"],
      ["Etherscan", "#"],
      ["Immunefi", "#"],
    ],
  ],
  [
    "LEGAL",
    [
      ["Method", "#"],
      ["Disclosures", "#"],
      ["Contact", "#"],
      ["© 2026", "#"],
    ],
  ],
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", position: "relative", overflow: "hidden" }}>
      <header
        style={{
          padding: "24px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 10,
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "var(--text)" }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              background: "var(--accent)",
              borderRadius: "50%",
              boxShadow: "0 0 12px var(--accent)",
            }}
          />
          <span className="serif" style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em" }}>
            Sovereign
          </span>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "var(--text-dim)",
              textTransform: "uppercase",
              paddingTop: 6,
            }}
          >
            Investment Group
          </span>
        </Link>
        <nav
          className="mono"
          style={{
            display: "flex",
            gap: 40,
            fontSize: 11,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          <a href="#intel" style={{ color: "var(--text-dim)", textDecoration: "none" }}>
            Intelligence
          </a>
          <a href="#suite" style={{ color: "var(--text-dim)", textDecoration: "none" }}>
            Suite
          </a>
          <a href="#trust" style={{ color: "var(--text-dim)", textDecoration: "none" }}>
            Trust
          </a>
        </nav>
        <div style={{ display: "flex", gap: 10 }}>
          <Link className="btn" href="/discover">
            Open App
          </Link>
          <Link className="btn btn-primary" href="/discover">
            Launch Terminal <Icons.arrow />
          </Link>
        </div>
      </header>

      <section style={{ padding: "40px 48px 80px", position: "relative", maxWidth: 1600, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 40, alignItems: "center" }}>
          <div className="fadeUp">
            <Eyebrow>ORBITAL INTELLIGENCE · V4.2</Eyebrow>
            <h1
              className="serif"
              style={{
                fontSize: "clamp(56px, 7vw, 112px)",
                fontWeight: 900,
                lineHeight: 0.92,
                letterSpacing: "-0.055em",
                margin: "28px 0",
                color: "var(--text)",
              }}
            >
              The sovereign
              <br />
              terminal for
              <br />
              <em
                style={{
                  color: "var(--accent)",
                  fontStyle: "italic",
                  fontWeight: 400,
                }}
              >
                on-chain yield.
              </em>
            </h1>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.55,
                color: "var(--text-dim)",
                maxWidth: 520,
                margin: "0 0 40px",
              }}
            >
              Ten thousand pools. One hundred and twenty chains. A single AI core that scores every protocol for
              legitimacy, stress-tests your allocation, and returns a risk-adjusted strategy in minutes — not weeks.
            </p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Link className="btn btn-primary" href="/discover">
                Enter Terminal <Icons.arrow />
              </Link>
              <Link className="btn" href="#intel">
                Read the method
              </Link>
            </div>
            <div
              style={{
                marginTop: 56,
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 0,
                borderTop: "1px solid var(--line)",
                paddingTop: 24,
              }}
            >
              {STATS.map(([v, l]) => (
                <div key={l} style={{ borderLeft: "1px solid var(--line)", paddingLeft: 18 }}>
                  <div
                    className="serif"
                    style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em" }}
                  >
                    {v}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.2em",
                      color: "var(--text-dim)",
                      marginTop: 4,
                      textTransform: "uppercase",
                    }}
                  >
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <OrbitalHero />
        </div>
      </section>

      <LandingTicker />

      <section
        id="intel"
        style={{ padding: "120px 48px", maxWidth: 1600, margin: "0 auto" }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 80, alignItems: "start" }}>
          <div>
            <Eyebrow>01 · THE METHOD</Eyebrow>
            <h2
              className="serif"
              style={{
                fontSize: 68,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 0.95,
                margin: "24px 0",
              }}
            >
              Evidence.
              <br />
              Not{" "}
              <em style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 400 }}>
                vibes.
              </em>
            </h2>
            <p style={{ color: "var(--text-dim)", lineHeight: 1.6, fontSize: 15, maxWidth: 400 }}>
              Every protocol in your allocation is scored across six legitimacy axes. Nothing enters the portfolio
              without a paper trail.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1px",
              background: "var(--line)",
            }}
          >
            {EVIDENCE.map((c) => (
              <div
                key={c.n}
                style={{ background: "var(--surface)", padding: 32, minHeight: 180 }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.2em",
                    color: "var(--text-dim)",
                    marginBottom: 16,
                  }}
                >
                  {c.n}
                </div>
                <div
                  className="serif"
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: "var(--accent)",
                    letterSpacing: "-0.03em",
                    marginBottom: 16,
                  }}
                >
                  {c.v}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55 }}>
                  {c.d}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="suite"
        style={{ padding: "0 48px 120px", maxWidth: 1600, margin: "0 auto" }}
      >
        <Eyebrow>02 · THE SUITE</Eyebrow>
        <h2
          className="serif"
          style={{
            fontSize: 68,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            margin: "24px 0 56px",
            maxWidth: 900,
          }}
        >
          Six instruments.
          <br />
          One{" "}
          <em style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 400 }}>
            cockpit.
          </em>
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1px",
            background: "var(--line)",
          }}
        >
          {SUITE.map((s) => (
            <Link
              key={s.k}
              href={s.href}
              style={{
                background: "var(--surface)",
                padding: 40,
                minHeight: 240,
                position: "relative",
                cursor: "pointer",
                transition: "all 0.4s",
                textDecoration: "none",
                color: "var(--text)",
                display: "block",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: "var(--accent)",
                  marginBottom: 24,
                }}
              >
                {s.k} / 06
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  marginBottom: 16,
                }}
              >
                {s.n}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.6 }}>
                {s.d}
              </div>
              <div
                className="mono"
                style={{
                  position: "absolute",
                  bottom: 40,
                  left: 40,
                  fontSize: 11,
                  color: "var(--text-dim)",
                  letterSpacing: "0.18em",
                }}
              >
                OPEN →
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section
        id="trust"
        style={{ padding: "0 48px 120px", maxWidth: 1600, margin: "0 auto" }}
      >
        <div
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "80px 48px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at center, var(--accent-soft), transparent 60%)",
              opacity: 0.7,
            }}
          />
          <div style={{ position: "relative" }}>
            <div style={{ display: "inline-flex" }}>
              <Eyebrow>AVERAGE PORTFOLIO SAFETY</Eyebrow>
            </div>
            <div
              className="serif"
              style={{
                fontSize: "clamp(96px, 16vw, 200px)",
                fontWeight: 900,
                letterSpacing: "-0.08em",
                lineHeight: 1,
                color: "var(--accent)",
                margin: "20px 0",
              }}
            >
              92
              <span style={{ color: "var(--text-muted)", fontSize: "50%" }}>/100</span>
            </div>
            <p style={{ fontSize: 18, color: "var(--text-dim)", maxWidth: 600, margin: "0 auto" }}>
              Across 3,104 protocols deep-analyzed by the Sovereign core. Updated every block.
            </p>
          </div>
        </div>
      </section>

      <section style={{ padding: "0 48px 80px", maxWidth: 1600, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 40,
            alignItems: "end",
            borderTop: "1px solid var(--line)",
            paddingTop: 80,
          }}
        >
          <h2
            className="serif"
            style={{
              fontSize: "clamp(48px, 6vw, 88px)",
              fontWeight: 900,
              letterSpacing: "-0.055em",
              lineHeight: 0.9,
            }}
          >
            Stop guessing.
            <br />
            Start{" "}
            <em style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 400 }}>
              compounding.
            </em>
          </h2>
          <div>
            <p
              style={{
                color: "var(--text-dim)",
                fontSize: 16,
                lineHeight: 1.6,
                marginBottom: 32,
              }}
            >
              No wallet connection required for analysis. Explore strategies, activate monitoring, or walk
              away. No fees, no lock-in.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="btn btn-primary" href="/discover">
                Enter Terminal <Icons.arrow />
              </Link>
              <Link className="btn" href="/discover">
                Browse Vaults
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer
        style={{
          padding: "60px 48px 40px",
          borderTop: "1px solid var(--line)",
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            maxWidth: 1600,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: 40,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  background: "var(--accent)",
                  borderRadius: "50%",
                }}
              />
              <div className="serif" style={{ fontSize: 18, fontWeight: 900 }}>
                Sovereign
              </div>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-dim)",
                maxWidth: 320,
                lineHeight: 1.55,
              }}
            >
              Institutional-grade DeFi intelligence. Built for allocators who read the docs.
            </div>
          </div>
          {FOOTER_COLUMNS.map(([h, arr]) => (
            <div key={h}>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "var(--text-dim)",
                  marginBottom: 16,
                }}
              >
                {h}
              </div>
              {arr.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  style={{
                    display: "block",
                    fontSize: 13,
                    color: "var(--text)",
                    marginBottom: 10,
                    textDecoration: "none",
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
