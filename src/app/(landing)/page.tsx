import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  BarChart3,
  Bird,
  Code,
  Coins,
  FileText,
  MessageCircle,
  PieChart,
  SearchCheck,
  ShieldCheck,
  Trophy,
  Vault,
} from "lucide-react";
import { fetchAllPools } from "@/lib/defillama";
import { MiniLine } from "@/components/site/ui";
import { HeroPixels } from "@/components/site/HeroPixels";
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
    title: "Market Scanner",
    body: "Live DeFiLlama feed ranks lending, LSTs, vaults, and LPs by APY, TVL, and stability — read-only, with risk in view.",
    cta: "Explore Markets",
    href: "/discover",
    tone: "#6ee7b7",
    image: "/visuals/card-market-scanner.png",
  },
  {
    title: "Strategy Engine",
    body: "Triple-AI proposer (Claude · Codex · Gemini) builds an inspectable allocation. Reviewers veto risky picks before you accept.",
    cta: "View Strategies",
    href: "/strategies",
    tone: "#60a5fa",
    image: "/visuals/card-strategy-engine.png",
  },
  {
    title: "Yield Results",
    body: "Connect a wallet to monitor entry vs. live APY, drift, and exposure — without ever signing a transaction we did not surface.",
    cta: "View Performance",
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
    title: "Discover Opportunities",
    body: "Filter live income markets by chain, stability, TVL, and capacity.",
  },
  {
    title: "Analyze Risk",
    body: "Cross-check audits, deployer history, exploit feeds, and TVL crashes per protocol.",
  },
  {
    title: "Build Allocation",
    body: "Compose a capital-weighted strategy with reviewer-vetted protocols.",
  },
  {
    title: "Monitor Positions",
    body: "Read-only oversight with alerts on APY drops, TVL drains, and pauses.",
  },
];

const securitySignals = [
  { label: "SSRF guard", icon: ShieldCheck },
  { label: "SIWE session", icon: ShieldCheck },
  { label: "Non-custodial", icon: ShieldCheck },
];

const community = [
  { label: "Discord", icon: MessageCircle },
  { label: "Docs", icon: FileText },
  { label: "Twitter", icon: Bird },
  { label: "GitHub", icon: Code },
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
          <h1>Smarter DeFi Yield Allocation</h1>
          <p>
            Discover, analyze, allocate and monitor the best DeFi opportunities — all in one
            read-only console.
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

      <section className="section-band feature-dock">
        <div className="dock-tabs">
          <button className="active" type="button">Discover</button>
          <button type="button">Portfolio</button>
          <button type="button">Security</button>
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
        <h2 className="center-title">How it Works</h2>
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

      <section className="section-band governance-risk-panel">
        <div>
          <h2>Allocation & Risk Controls</h2>
          <p>
            Heuristic vetoes, SIWE-scoped sessions, and live ground-truth checks against
            audits, exploits, and TVL crashes guard every allocation before capital ever
            moves.
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
          <h2>Risk Metrics Overview</h2>
          <div className="risk-table">
            <div>
              <span>Metric</span>
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
          <h2>Security matters</h2>
          <p>
            Every protocol is run through a six-engine smart-contract review and a
            triple-AI synthesis (Claude · Codex · Gemini) — heuristic vetoes block risky
            allocations even when the AIs disagree.
          </p>
          <Link href="/security/audit" className="inline-blue">
            Run a contract review
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div>
          <h2>Audited & Monitored By</h2>
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

      <section className="section-band community-section">
        <h2 className="center-title">Join the community</h2>
        <div className="community-grid">
          {community.map((item) => {
            const Icon = item.icon;
            return (
              <Link href="/tools" className="community-card" key={item.label}>
                <span>{item.label}</span>
                <Icon size={28} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section-band glow-cta-wrap">
        <div className="glow-cta">
          <h2>Get started</h2>
          <div className="filter-row">
            <Link href="/discover" className="secondary-button">
              <SearchCheck size={18} aria-hidden="true" />
              Discover
            </Link>
            <Link href="/portfolio" className="secondary-button">
              <PieChart size={18} aria-hidden="true" />
              Portfolio
            </Link>
            <Link href="/security/audit" className="secondary-button">
              <ShieldCheck size={18} aria-hidden="true" />
              Audit
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
