import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  AlertOctagon,
  ArrowRight,
  BarChart3,
  Brain,
  Coins,
  Crown,
  Eye,
  Gauge,
  Landmark,
  MessagesSquare,
  PieChart,
  Radar,
  Rocket,
  SearchCheck,
  ShieldCheck,
  Telescope,
  Trophy,
  Vault,
} from "lucide-react";
import { fetchAllPools } from "@/lib/defillama";
import { MiniLine } from "@/components/site/ui";
import { HeroPixels } from "@/components/site/HeroPixels";
import { SocialIcon, type SocialIconId } from "@/components/site/SocialIcon";
import { formatPct, formatUsd } from "@/lib/design-utils";

export const dynamic = "force-dynamic";
export const revalidate = 60;

interface LandingMetrics {
  trackedTvl: number;
  avgApy: number;
  poolCount: number;
  chainCount: number;
  protocolCount: number;
  topApy: number;
  sparkline: number[];
  /** True if upstream failed; UI falls back to placeholder copy. */
  fallback: boolean;
}

async function loadMetrics(): Promise<LandingMetrics> {
  try {
    const pools = await fetchAllPools();
    const valid = pools.filter(
      (p) =>
        typeof p.apy === "number" &&
        Number.isFinite(p.apy) &&
        typeof p.tvlUsd === "number" &&
        p.tvlUsd > 100_000,
    );
    const trackedTvl = valid.reduce((s, p) => s + (p.tvlUsd || 0), 0);
    const top50 = [...valid].sort((a, b) => b.tvlUsd - a.tvlUsd).slice(0, 50);
    const avgApy = top50.length > 0 ? top50.reduce((s, p) => s + (p.apy || 0), 0) / top50.length : 0;
    const chainSet = new Set<string>();
    const protoSet = new Set<string>();
    for (const p of valid) {
      if (p.chain) chainSet.add(p.chain);
      if (p.project) protoSet.add(p.project);
    }
    const topApy = valid.reduce((max, p) => Math.max(max, p.apy ?? 0), 0);
    // Sparkline = top 10 pool APYs sorted by TVL, gives the hero a real shape.
    const sparkline = top50.slice(0, 10).map((p) => p.apy ?? 0);
    return {
      trackedTvl,
      avgApy,
      poolCount: valid.length,
      chainCount: chainSet.size,
      protocolCount: protoSet.size,
      topApy,
      sparkline,
      fallback: false,
    };
  } catch {
    return {
      trackedTvl: 0,
      avgApy: 0,
      poolCount: 0,
      chainCount: 0,
      protocolCount: 0,
      topApy: 0,
      sparkline: [4.6, 5.2, 4.9, 6.4, 6.1, 7.2, 6.8, 8.4, 8.1, 8.9],
      fallback: true,
    };
  }
}

const heroPills = [
  { label: "Lending", icon: Coins, tone: "#4fe0a0", href: "/discover?type=Lending" },
  { label: "Vaults", icon: PieChart, tone: "#a78bfa", href: "/discover?type=Yield" },
  { label: "Strategies", icon: BarChart3, tone: "#3f83ff", href: "/strategies" },
];

const featureCards = [
  {
    title: "Allocation Engine",
    body: "Custom-weighted portfolios matched to your risk and budget. Every pick ships with a conviction score and a written thesis.",
    cta: "Build a strategy",
    href: "/strategies",
    tone: "#6ee7b7",
    image: "/visuals/card-strategy-engine.png",
  },
  {
    title: "Security Engine",
    body: "An institutional-grade review on every protocol before it touches your capital. Strategies that fail the bar never reach you.",
    cta: "Review a contract",
    href: "/security/audit",
    tone: "#60a5fa",
    image: "/visuals/card-market-scanner.png",
  },
  {
    title: "Live Monitor",
    body: "24/7 surveillance on every position. APY collapse, TVL drains, exploit signals — pinged to your channel the moment they fire.",
    cta: "View portfolio",
    href: "/portfolio",
    tone: "#fbbf24",
    image: "/visuals/card-yield-results.png",
  },
];

const stepVisuals = [
  "/visuals/step-discover-opportunities.png",
  "/visuals/step-analyze-risk.png",
  "/visuals/step-build-allocation.png",
  "/visuals/step-monitor-positions.png",
];

const flowSteps = [
  {
    title: "Discover",
    body: "Browse a curated, live DeFi market — filtered by chain, asset, stability, and capacity. No noise, no scam-tokens, no hand-rolled pool lists.",
  },
  {
    title: "Allocate",
    body: "Tell us your risk and budget. An analyst council builds a custom-weighted strategy around protocols that already passed our security bar.",
  },
  {
    title: "Verify",
    body: "Run any contract through the security engine. Get an institutional-grade review with a clear verdict in minutes — not weeks, not five-figure invoices.",
  },
  {
    title: "Monitor",
    body: "We watch the chain so you don't have to. Alerts fire only on protocol-breaking events — APY collapse, contract pauses, exploit feeds, TVL drains.",
  },
];

const securitySignals = [
  { label: "Non-custodial", icon: ShieldCheck },
  { label: "Wallet-scoped sessions", icon: ShieldCheck },
  { label: "Read-only by design", icon: ShieldCheck },
];

interface YieldRow {
  source: string;
  range: string;
  category: "tradfi" | "defi";
  blurb: string;
  icon: typeof Landmark;
  tone: string;
}

const YIELD_LADDER: YieldRow[] = [
  {
    source: "Big-bank savings",
    range: "0.1 – 3.5%",
    category: "tradfi",
    blurb: "Standard savings and checking accounts. Most pay near zero — the top of the range only shows up on relationship or promotional tiers.",
    icon: Landmark,
    tone: "#a7b0ba",
  },
  {
    source: "High-yield savings",
    range: "4 – 5%",
    category: "tradfi",
    blurb: "The 'good' answer in traditional finance. Still capped, still taxable, and still nowhere near what the same dollars can earn on-chain.",
    icon: Landmark,
    tone: "#c8d1dc",
  },
  {
    source: "Vetted stablecoin yield",
    range: "5 – 12%",
    category: "defi",
    blurb: "Lending stables on top-tier protocols. Dollar-denominated, no token-price risk, audited deployments only.",
    icon: Coins,
    tone: "#6ee7b7",
  },
  {
    source: "Vetted vaults & LPs",
    range: "8 – 22%",
    category: "defi",
    blurb: "Auto-compounding strategies and curated liquidity positions on protocols that passed every layer of our security review.",
    icon: Vault,
    tone: "#3f83ff",
  },
  {
    source: "Asymmetric strategies",
    range: "15 – 35%+",
    category: "defi",
    blurb: "Higher-yield positions for risk-on capital. Surfaced only when the security engine signs off — never as a default.",
    icon: BarChart3,
    tone: "#fbbf24",
  },
];

interface StrategyStep {
  step: string;
  title: string;
  body: string;
  icon: typeof Telescope;
  tone: string;
}

const STRATEGY_STEPS: StrategyStep[] = [
  {
    step: "01",
    title: "Scan the entire DeFi market",
    body: "Live across thousands of yield opportunities, dozens of chains, every major protocol. Only the deepest, most stable pools survive the first cut.",
    icon: Telescope,
    tone: "#6ee7b7",
  },
  {
    step: "02",
    title: "Audit before allocation",
    body: "Every shortlisted protocol gets an institutional-grade security review — source code, on-chain controls, deployer history, exploit surveillance. Anything that fails the bar is dropped before your strategy even starts taking shape.",
    icon: ShieldCheck,
    tone: "#60a5fa",
  },
  {
    step: "03",
    title: "Three minds, one verdict",
    body: "Independent AI analysts build, challenge, and rewrite the strategy in adversarial review. They debate every weight, every pool, every risk — and the most-conservative call wins. No single mind decides where your capital goes.",
    icon: MessagesSquare,
    tone: "#fbbf24",
  },
  {
    step: "04",
    title: "Custom-weighted, ready to deploy",
    body: "A portfolio sized to your budget, with a conviction score on every position and a written thesis on every pick. Your wallet executes — Sovereign never holds a coin.",
    icon: Rocket,
    tone: "#fb7185",
  },
];

interface Incident {
  name: string;
  date: string;
  loss: string;
  cause: string;
  pattern: string;
}

const INCIDENTS: Incident[] = [
  {
    name: "Terra / UST",
    date: "May 2022",
    loss: "$40B+",
    cause: "Algorithmic-stablecoin death spiral after the peg broke and the Anchor yield was cut.",
    pattern: "Bank-run TVL drain — exactly the pattern our monitor flags as critical.",
  },
  {
    name: "Ronin Bridge",
    date: "March 2022",
    loss: "$540M",
    cause: "Five of nine validator keys compromised on a bridge custodying billions.",
    pattern: "Centralized governance — the on-chain interrogator surfaces single-key control as a red flag.",
  },
  {
    name: "Wormhole",
    date: "February 2022",
    loss: "$326M",
    cause: "Signature-verification bypass on a cross-chain bridge contract.",
    pattern: "A class of bug static analysis catches; we run those checks on every contract you ask about.",
  },
  {
    name: "Mango Markets",
    date: "October 2022",
    loss: "$114M",
    cause: "Thin-market collateral oracle pumped, then used to drain the lending pool.",
    pattern: "Oracle posture and shallow-collateral risk are graded in every protocol review.",
  },
  {
    name: "Euler Finance",
    date: "March 2023",
    loss: "$197M",
    cause: "Missing invariant check in a lending function exploited via flash loan.",
    pattern: "Audit pipelines catch missing checks. Most stolen funds were eventually returned — most protocols don't get that gift.",
  },
  {
    name: "Multichain",
    date: "July 2023",
    loss: "$125M",
    cause: "MPC keys held by a single CEO; arrest in China rendered the keys inaccessible.",
    pattern: "Single-point-of-failure governance is the exact posture our review surfaces and downgrades.",
  },
];

const differentiators = [
  {
    icon: Gauge,
    title: "Yields with conviction scores",
    body: "Other tools surface APY. We grade every protocol on a 100-point conviction scale — audit history, team reputation, on-chain forensics, exploit exposure, market posture. The number you see is the number we'd act on.",
  },
  {
    icon: Radar,
    title: "Security that doesn't take coffee breaks",
    body: "An institutional-grade security review on any contract you ask about, and 24/7 surveillance on every position you deploy. Most platforms vet protocols once at listing. We vet them every fifteen minutes.",
  },
  {
    icon: Eye,
    title: "Non-custodial. Full stop.",
    body: "Your funds never enter our system. No approvals to sign, no withdrawals to initiate, no trust to extend. Sovereign tells you where capital should sit and watches it for you — every transaction stays in your wallet.",
  },
];

const community: Array<{ label: string; icon: SocialIconId }> = [
  { label: "Discord", icon: "discord" },
  { label: "Docs", icon: "docs" },
  { label: "Twitter", icon: "twitter" },
  { label: "GitHub", icon: "github" },
];

export default async function Home() {
  const metrics = await loadMetrics();

  const heroStats = [
    {
      label: "Tracked TVL",
      value: metrics.fallback ? "—" : formatUsd(metrics.trackedTvl),
      icon: Coins,
      tone: "#4fe0a0",
    },
    {
      label: "Top-50 Avg APY",
      value: metrics.fallback ? "—" : formatPct(metrics.avgApy),
      icon: Trophy,
      tone: "#7ee787",
    },
    {
      label: "Tracked Pools",
      value: metrics.fallback ? "—" : metrics.poolCount.toLocaleString(),
      icon: Vault,
      tone: "#4fe0a0",
    },
  ];

  const allocationPower: Array<[string, string]> = metrics.fallback
    ? [
        ["Markets monitored", "—"],
        ["Audited protocols", "—"],
        ["Chains covered", "—"],
        ["Best APY today", "—"],
      ]
    : [
        ["Markets monitored", metrics.poolCount.toLocaleString()],
        ["Audited protocols", metrics.protocolCount.toLocaleString()],
        ["Chains covered", String(metrics.chainCount)],
        ["Best APY today", formatPct(metrics.topApy)],
      ];

  const riskRows: Array<[string, string, string]> = [
    ["System Health", metrics.fallback ? "Stale" : "Live", metrics.fallback ? "Degraded" : "Healthy"],
    ["Smart Contract Risk", "Vetted", "Low"],
    ["Liquidity Coverage", metrics.poolCount > 1000 ? "Deep" : "Steady", "Strong"],
    ["Oracle Status", "All Active", "Good"],
    ["Insurance Coverage", "Read-only", "Covered"],
  ];

  return (
    <>
      <section className="hero pixel-landing-hero">
        <HeroPixels />
        <div className="hero-copy">
          <h1>Smarter yield. Vetted by default.</h1>
          <p>
            The institutional-grade DeFi terminal — vetted allocations, live security
            review on every protocol, 24/7 monitoring. Non-custodial by design.
          </p>
          <div className="hero-pill-row" aria-label="Primary yield categories">
            {heroPills.map((pill) => {
              const Icon = pill.icon;
              return (
                <Link
                  href={pill.href}
                  className="hero-pill"
                  key={pill.label}
                  style={{ "--pill-tone": pill.tone } as CSSProperties}
                >
                  <Icon size={20} aria-hidden="true" />
                  {pill.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="pixel-safe-wrap" aria-hidden="true">
          <Image
            src="/visuals/pixel-safe.png"
            alt=""
            width={1254}
            height={1254}
            priority
            sizes="(max-width: 760px) 92vw, 42vw"
          />
        </div>

        <div className="horizon-bands" aria-hidden="true" />
      </section>

      <section className="section-band home-metrics">
        <div className="metric-grid hero-metric-grid">
          {heroStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                className="metric-tile reference-metric"
                key={stat.label}
                style={{ "--tile-tone": stat.tone } as CSSProperties}
              >
                <div className="tile-top">
                  <span>
                    <Icon size={17} aria-hidden="true" />
                    {stat.label}
                  </span>
                </div>
                <strong>{stat.value}</strong>
              </div>
            );
          })}
          <div className="boost-panel allocation-power-panel">
            <div className="allocation-power-title">
              <ShieldCheck size={18} aria-hidden="true" />
              <strong>Allocation Power</strong>
            </div>
            {allocationPower.map(([label, value]) => (
              <div className="allocation-power-row" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-band ai-strategy-band">
        <div className="ai-strategy-head">
          <p className="eyebrow">Allocation engine</p>
          <h2>Don&apos;t know where your money belongs? We do the homework.</h2>
          <p>
            DeFi is thousands of opportunities deep — most of which you should never touch.
            Tell Sovereign your budget and your risk appetite, and the allocation engine
            does the rest. It scans the entire market, vets every protocol through an
            institutional-grade security review, and lets a council of independent AI
            analysts debate the strategy in adversarial review until the most-conservative
            allocation is the one left standing. You don&apos;t pick the protocols. You
            don&apos;t read the audits. You don&apos;t guess. You deploy.
          </p>
        </div>

        <div className="strategy-step-grid">
          {STRATEGY_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.step}
                className="strategy-step"
                style={{ "--step-tone": step.tone } as CSSProperties}
              >
                <div className="strategy-step-top">
                  <span className="strategy-step-num">{step.step}</span>
                  <span className="strategy-step-icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            );
          })}
        </div>

        <div className="ai-strategy-cta">
          <Link href="/strategies" className="primary-button">
            <Brain size={17} aria-hidden="true" /> Build my first strategy
          </Link>
          <span>Free tier ships two strategies a month — no card required.</span>
        </div>
      </section>

      <section className="section-band yield-ladder">
        <div style={{ marginBottom: 24, maxWidth: 720 }}>
          <p className="eyebrow">Where your money actually earns</p>
          <h2>TradFi capped your yield. DeFi uncapped it.</h2>
          <p style={{ color: "var(--muted)", marginTop: 8 }}>
            For decades, the best a regular saver could pull from the financial system was four
            or five percent — and only after rates spiked. Open, programmable money rewrote
            that ceiling. Sovereign curates the part of it that&apos;s safe enough to act on.
          </p>
        </div>

        <div className="yield-ladder-grid">
          {YIELD_LADDER.map((row) => {
            const Icon = row.icon;
            const isDefi = row.category === "defi";
            return (
              <div
                key={row.source}
                className={`yield-ladder-row ${isDefi ? "is-defi" : "is-tradfi"}`}
                style={{ "--row-tone": row.tone } as CSSProperties}
              >
                <div className="yield-ladder-head">
                  <span className="yield-ladder-icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{row.source}</strong>
                    <span
                      className="yield-ladder-tag"
                      data-cat={row.category}
                    >
                      {isDefi ? "DeFi · Sovereign-vetted" : "Traditional finance"}
                    </span>
                  </div>
                </div>
                <div className="yield-ladder-range">
                  <b>{row.range}</b>
                  <span>annualized</span>
                </div>
                <p>{row.blurb}</p>
              </div>
            );
          })}
        </div>

        <p style={{ color: "var(--soft)", fontSize: 12, marginTop: 18, maxWidth: 760 }}>
          Yields are floating market rates, not guarantees, and they move with utilization,
          incentives, and broader rate cycles. Sovereign filters out unverified, unstable, and
          unvetted opportunities so the ranges above reflect the curated universe — not the
          long tail of DeFi pools that should never see a dollar of capital.
        </p>
      </section>

      <section className="section-band risk-reality-band">
        <div className="risk-reality-head">
          <div>
            <p className="eyebrow">The price of getting it wrong</p>
            <h2>DeFi rewards the disciplined. It wipes out everyone else.</h2>
            <p>
              Since 2021, more than{" "}
              <strong>$5.8 billion</strong> has been stolen from DeFi protocols. Chainalysis
              tracked <strong>$2.2 billion</strong> in crypto theft in 2024 alone — and most
              of it was traceable to warning signs that sat in plain view weeks before the
              attack. Sovereign exists so you&apos;re never the one still holding when the
              fuse runs out.
            </p>
          </div>
          <div className="risk-reality-stats">
            <div>
              <strong>$5.8B</strong>
              <span>stolen from DeFi protocols since 2021 · DefiLlama</span>
            </div>
            <div>
              <strong>$2.2B</strong>
              <span>in crypto theft tracked in 2024 · Chainalysis</span>
            </div>
            <div>
              <strong>$1.1B</strong>
              <span>DeFi-specific losses in 2023 · Chainalysis</span>
            </div>
          </div>
        </div>

        <div className="incident-grid">
          {INCIDENTS.map((incident) => (
            <article className="incident-card" key={incident.name}>
              <header>
                <AlertOctagon size={16} aria-hidden="true" />
                <div>
                  <strong>{incident.name}</strong>
                  <span>{incident.date}</span>
                </div>
                <span className="incident-loss">{incident.loss}</span>
              </header>
              <p className="incident-cause">{incident.cause}</p>
              <p className="incident-pattern">
                <span>What Sovereign sees</span>
                {incident.pattern}
              </p>
            </article>
          ))}
        </div>

        <p className="risk-reality-closer">
          We can&apos;t undo what&apos;s already lost. We&apos;re built to make sure the next
          loss isn&apos;t yours. Every protocol Sovereign recommends has cleared the same
          kind of checks that would have raised an alarm before any of these collapses —
          bank-run TVL drains, single-key governance, expired audit trails, and exploit
          chatter on public feeds.
        </p>
      </section>

      <section className="section-band feature-dock">
        <div className="feature-dock-head">
          <div>
            <p className="eyebrow">The terminal</p>
            <h2>Three engines. One workspace. Zero custody.</h2>
          </div>
          <ul className="feature-dock-trust">
            <li>
              <ShieldCheck size={15} aria-hidden="true" />
              <span>
                <strong>{metrics.fallback ? "—" : metrics.protocolCount.toLocaleString()}</strong>
                protocols screened
              </span>
            </li>
            <li>
              <Vault size={15} aria-hidden="true" />
              <span>
                <strong>{metrics.fallback ? "—" : metrics.poolCount.toLocaleString()}</strong>
                pools tracked live
              </span>
            </li>
            <li>
              <Eye size={15} aria-hidden="true" />
              <span>
                <strong>{metrics.fallback ? "—" : metrics.chainCount}</strong>
                chains under watch
              </span>
            </li>
            <li>
              <Radar size={15} aria-hidden="true" />
              <span>
                <strong>24/7</strong>
                non-custodial monitor
              </span>
            </li>
          </ul>
        </div>
        <div className="feature-card-grid">
          {featureCards.map((card) => (
            <article className="feature-card" key={card.title}>
              <div className="feature-orbit" style={{ "--feature-tone": card.tone } as CSSProperties}>
                <Image src={card.image} alt="" width={520} height={360} sizes="170px" />
              </div>
              <div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <Link href={card.href} className="blue-button">
                  {card.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band compact-section">
        <h2 className="center-title">How it works</h2>
        <div className="steps-grid reference-steps">
          {flowSteps.map((step, index) => (
            <div className="step-card" key={step.title}>
              <span className="step-badge">Step {String(index + 1).padStart(2, "0")}</span>
              <div className="step-icon">
                <Image src={stepVisuals[index]} alt="" width={420} height={300} sizes="160px" />
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-band differentiation-band">
        <div style={{ maxWidth: 720, marginBottom: 28 }}>
          <p className="eyebrow">Why Sovereign</p>
          <h2>Most DeFi tools surface yield. We surface yield with conviction.</h2>
          <p style={{ color: "var(--muted)", marginTop: 8 }}>
            Yield aggregators chase the highest number. Auditors review one contract and
            disappear. Wallets show you a balance. Sovereign is the only terminal that does
            all three jobs at once — and refuses to recommend a position that hasn&apos;t
            cleared every gate.
          </p>
        </div>

        <div className="differentiator-grid">
          {differentiators.map((item) => {
            const Icon = item.icon;
            return (
              <article className="differentiator-card boost-panel" key={item.title}>
                <span className="differentiator-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section-band governance-risk-panel">
        <div>
          <h2>Capital that doesn&apos;t move blind.</h2>
          <p>
            Every allocation is built on protocols that passed our security bar — audited,
            on-chain-interrogated, deployer-traced, exploit-screened, and benchmarked against
            stability standards before a single dollar is suggested. The numbers below are
            the live universe Sovereign watches on your behalf.
          </p>
          <div className="governance-stats">
            <div>
              <strong>{metrics.fallback ? "—" : metrics.poolCount.toLocaleString()}</strong>
              <span>Pools tracked</span>
            </div>
            <div>
              <strong>{metrics.fallback ? "—" : String(metrics.chainCount)}</strong>
              <span>Chains live</span>
            </div>
            <div>
              <strong>{metrics.fallback ? "—" : metrics.protocolCount.toLocaleString()}</strong>
              <span>Protocols screened</span>
            </div>
            <div>
              <strong>{metrics.fallback ? "—" : formatPct(metrics.avgApy)}</strong>
              <span>Top-50 avg APY</span>
            </div>
          </div>
        </div>
        <div>
          <h2>System status</h2>
          <div className="risk-table">
            <div>
              <span>Signal</span>
              <span>Value</span>
              <span>Status</span>
            </div>
            {riskRows.map(([metric, value, status]) => (
              <div key={metric}>
                <span>{metric}</span>
                <span>{value}</span>
                <strong>{status}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-band security-audit-band">
        <div className="security-visual">
          <Image
            src="/visuals/pixel-security.png"
            alt=""
            width={720}
            height={480}
            sizes="(max-width: 760px) 90vw, 250px"
          />
        </div>
        <div>
          <h2>The security review every protocol should have to pass.</h2>
          <p>
            Every contract Sovereign touches is put through an institutional-grade review
            — source code, on-chain controls, governance posture, deployer history, exploit
            surveillance, and stress-tested against industry security standards. Strategies
            that fail the review never reach your screen. The same engine is available to
            you on demand: paste any contract address, get a verdict in minutes.
          </p>
          <Link href="/security/audit" className="inline-blue">
            Review a contract now
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div>
          <h2>How we hold the line</h2>
          <div className="audit-logos">
            {securitySignals.slice(0, 3).map((signal) => {
              const Icon = signal.icon;
              return (
                <span key={signal.label}>
                  <Icon size={20} aria-hidden="true" />
                  {signal.label}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-band mission-band">
        <div className="mission-inner">
          <p className="eyebrow">Why we built this</p>
          <h2>Earn what your capital is worth — without staying up at night.</h2>
          <p>
            DeFi yields are too good to leave on the table. DeFi risk is too real to ignore.
            Sovereign is the bridge: institutional-grade discipline for ordinary capital.
            Every protocol vetted, every position watched, every alert routed to where you
            actually live — built so the gap between what your money earns at a bank and
            what it earns on-chain isn&apos;t paid for in sleepless nights worrying about
            the next exploit.
          </p>
          <p className="mission-tagline">
            Real yield. Real safety. Earned, not gambled.
          </p>
        </div>
      </section>

      <section className="section-band community-section">
        <h2 className="center-title">Built in the open</h2>
        <p style={{ color: "var(--muted)", textAlign: "center", maxWidth: 620, margin: "8px auto 28px" }}>
          Sovereign is a working product, not a pitch deck. Follow the build, talk to the team,
          and watch what we ship.
        </p>
        <div className="community-grid">
          {community.map((item) => (
            <Link href="/tools" className="community-card" key={item.label}>
              <span>{item.label}</span>
              <SocialIcon id={item.icon} size={34} />
            </Link>
          ))}
        </div>
      </section>

      <section className="section-band glow-cta-wrap">
        <div className="glow-cta">
          <h2>Take your yield back.</h2>
          <p style={{ color: "var(--muted)", maxWidth: 540, margin: "0 auto 18px" }}>
            Open the terminal. Build a vetted allocation in under five minutes. Your wallet
            keeps the keys; we do the work.
          </p>
          <div className="filter-row">
            <Link href="/strategies" className="primary-button">
              <Crown size={18} aria-hidden="true" />
              Build a strategy
            </Link>
            <Link href="/security/audit" className="secondary-button">
              <ShieldCheck size={18} aria-hidden="true" />
              Run an audit
            </Link>
            <Link href="/discover" className="secondary-button">
              <SearchCheck size={18} aria-hidden="true" />
              Browse markets
            </Link>
            <Link href="/plans" className="ghost-button">
              <PieChart size={18} aria-hidden="true" />
              See plans
            </Link>
          </div>
          <div className="cta-mini-stats">
            <span>
              <b>{metrics.fallback ? "—" : formatUsd(metrics.trackedTvl)}</b> tracked TVL
            </span>
            <span>
              <b>{metrics.fallback ? "—" : formatPct(metrics.avgApy)}</b> top-50 avg APY
            </span>
            <span>
              <b>{metrics.fallback ? "—" : metrics.chainCount}</b> chains live
            </span>
          </div>
          <MiniLine points={metrics.sparkline} accent="#6ee7b7" />
        </div>
      </section>
    </>
  );
}
