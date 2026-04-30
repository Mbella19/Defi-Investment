import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Bell,
  Bot,
  Check,
  Crown,
  LifeBuoy,
  Minus,
  Radio,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { CommandStrip } from "@/components/site/ui";

type TierId = "free" | "pro" | "ultra";

interface PlanFeature {
  label: string;
  included: boolean;
}

interface Plan {
  tier: TierId;
  name: string;
  badge?: string;
  icon: LucideIcon;
  price: string;
  cadence: string;
  pitch: string;
  features: PlanFeature[];
  ctaLabel: string;
  ctaHref: string;
  ctaClass: string;
  accent: string;
}

const PLANS: Plan[] = [
  {
    tier: "free",
    name: "Free",
    icon: Sparkles,
    price: "$0",
    cadence: "/month",
    pitch:
      "Get on the terminal — full smart-contract audit and a taste of the strategy engine with a solo strategist.",
    accent: "#a7b0ba",
    ctaLabel: "Start free",
    ctaHref: "/strategies",
    ctaClass: "secondary-button",
    features: [
      { label: "2 strategies per month", included: true },
      { label: "Solo strategist — single mind working alone", included: true },
      { label: "Full access to the six-engine smart-contract audit", included: true },
      { label: "Risk-band selection (Conservative · Balanced · Asymmetric)", included: false },
      { label: "Stablecoin-only allocation toggle", included: false },
      { label: "Real-time portfolio alerts", included: false },
      { label: "Workspace tools — Simulator, Correlation, Portfolio lens", included: false },
      { label: "Custom APY-range mode", included: false },
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    badge: "Most popular",
    icon: Zap,
    price: "$100",
    cadence: "/month",
    pitch:
      "Operating mode for active allocators — dual-strategist synthesis, full toolkit, real-time alerts on every active mandate.",
    accent: "#6ee7b7",
    ctaLabel: "Upgrade to Pro",
    ctaHref: "/plans/checkout?tier=pro",
    ctaClass: "wallet-button",
    features: [
      { label: "Everything in Free", included: true },
      { label: "20 strategies per month", included: true },
      { label: "Dual strategist synthesis — two minds cross-reviewing each other", included: true },
      { label: "Risk-band selection unlocked", included: true },
      { label: "Stablecoin-only sleeves", included: true },
      { label: "Real-time alerts on active portfolio", included: true },
      { label: "All workspace tools — Simulator · Correlation · Audit · Portfolio lens", included: true },
      { label: "Custom APY-range mode", included: false },
      { label: "Email · Slack · Telegram · SMS alert delivery", included: false },
    ],
  },
  {
    tier: "ultra",
    name: "Ultra",
    badge: "Most powerful",
    icon: Crown,
    price: "$200",
    cadence: "/month",
    pitch:
      "The full strategist council — three minds, custom APY targeting, and alerts wherever you live.",
    accent: "#fbbf24",
    ctaLabel: "Go Ultra",
    ctaHref: "/plans/checkout?tier=ultra",
    ctaClass: "primary-button",
    features: [
      { label: "Everything in Pro", included: true },
      { label: "60 strategies per month", included: true },
      { label: "Strategist council — three minds with synthesis + veto layer", included: true },
      { label: "Custom APY-range mode in the allocation composer", included: true },
      { label: "Alerts to Email · Slack · Telegram · SMS · Discord", included: true },
      { label: "Premium customer support (priority queue)", included: true },
    ],
  },
];

interface MatrixGroup {
  title: string;
  rows: MatrixRow[];
}

type MatrixCell = string | boolean;

interface MatrixRow {
  feature: string;
  free: MatrixCell;
  pro: MatrixCell;
  ultra: MatrixCell;
}

const MATRIX: MatrixGroup[] = [
  {
    title: "Strategy engine",
    rows: [
      { feature: "Monthly strategies", free: "2", pro: "20", ultra: "60" },
      {
        feature: "Strategy engine depth",
        free: "Solo strategist",
        pro: "Dual synthesis",
        ultra: "Strategist council",
      },
      { feature: "Risk-band selection", free: false, pro: true, ultra: true },
      { feature: "Stablecoin-only sleeves", free: false, pro: true, ultra: true },
      { feature: "Custom APY-range mode", free: false, pro: false, ultra: true },
      { feature: "Heuristic veto layer", free: true, pro: true, ultra: true },
    ],
  },
  {
    title: "Workspace",
    rows: [
      { feature: "Six-engine smart-contract audit", free: true, pro: true, ultra: true },
      { feature: "Scenario simulator", free: false, pro: true, ultra: true },
      { feature: "Correlation matrix", free: false, pro: true, ultra: true },
      { feature: "Portfolio lens", free: false, pro: true, ultra: true },
    ],
  },
  {
    title: "Alerts & support",
    rows: [
      { feature: "Real-time portfolio alerts", free: false, pro: true, ultra: true },
      {
        feature: "Alert channels",
        free: "—",
        pro: "Discord",
        ultra: "Discord · Email · Slack · Telegram · SMS",
      },
      {
        feature: "Customer support",
        free: "Community",
        pro: "Standard",
        ultra: "Premium · priority queue",
      },
    ],
  },
];

interface FaqItem {
  title: string;
  body: string;
  icon: LucideIcon;
}

const FAQ: FaqItem[] = [
  {
    icon: BadgeDollarSign,
    title: "Cancel anytime",
    body: "Plans bill monthly. Cancel from your account and you keep the tier through the current period.",
  },
  {
    icon: ShieldCheck,
    title: "Non-custodial by design",
    body: "Sovereign never moves your funds. We surface, score, and monitor positions — every transaction stays in your wallet.",
  },
  {
    icon: LifeBuoy,
    title: "Need a custom volume?",
    body: "Funds, DAOs, and treasuries with sustained scan volume can request a tailored quote with dedicated SLAs.",
  },
];

export const metadata = {
  title: "Plans — Sovereign",
  description:
    "Pick the Sovereign tier that fits how aggressively you allocate. Free, Pro at $100/month, Ultra at $200/month.",
};

export default function PlansPage() {
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Plans</p>
          <h1>Tier up your edge.</h1>
          <p>
            Three tiers, one terminal. Start free with the full smart-contract audit, scale into
            dual- or triple-AI synthesis, and unlock the custom-APY composer when you want
            surgical control.
          </p>
        </div>
      </div>

      <CommandStrip
        file="file/07.plans"
        items={[
          { label: "billing", value: "monthly", tone: "info" },
          { label: "tiers", value: "3 active", tone: "ok" },
          { label: "switch", value: "anytime", tone: "warn" },
        ]}
      />

      <div className="plans-grid">
        {PLANS.map((plan) => {
          const TierIcon = plan.icon;
          const isFeatured = plan.tier === "pro";
          return (
            <article
              key={plan.tier}
              className={`plan-card ${isFeatured ? "is-featured" : ""}`}
              style={{ "--plan-accent": plan.accent } as React.CSSProperties}
            >
              {plan.badge ? <span className="plan-badge">{plan.badge}</span> : null}

              <header className="plan-head">
                <span className="plan-tier">
                  <TierIcon size={16} aria-hidden="true" />
                  <strong>{plan.name}</strong>
                </span>
                <h2 className="plan-name">{plan.name} plan</h2>
                <div className="plan-price">
                  <b>{plan.price}</b>
                  <span>{plan.cadence}</span>
                </div>
                <p className="plan-pitch">{plan.pitch}</p>
              </header>

              <ul className="plan-features">
                {plan.features.map((feat) => (
                  <li
                    key={feat.label}
                    className={feat.included ? "is-on" : "is-off"}
                  >
                    {feat.included ? (
                      <Check size={16} aria-hidden="true" className="feat-check" />
                    ) : (
                      <X size={16} aria-hidden="true" className="feat-cross" />
                    )}
                    <span>{feat.label}</span>
                  </li>
                ))}
              </ul>

              <div className="plan-cta-row">
                <Link href={plan.ctaHref} className={`${plan.ctaClass} plan-cta`}>
                  <TierIcon size={17} aria-hidden="true" />
                  {plan.ctaLabel}
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <div className="plan-matrix-wrap">
        <div className="section-header" style={{ marginBottom: 18 }}>
          <div>
            <p className="eyebrow">Compare side-by-side</p>
            <h2>Feature matrix</h2>
            <p>
              Everything in one grid — what unlocks at each tier across the strategy engine,
              workspace, and alert channels.
            </p>
          </div>
        </div>

        <div className="plan-matrix">
          <div className="plan-matrix-row is-header">
            <div className="plan-matrix-cell">
              <span>Feature</span>
            </div>
            {PLANS.map((plan) => (
              <div className="plan-matrix-cell" key={plan.tier}>
                <strong>{plan.name}</strong>
                <span>{plan.price}{plan.tier === "free" ? "" : plan.cadence}</span>
              </div>
            ))}
          </div>

          {MATRIX.map((group) => (
            <div className="plan-matrix-group" key={group.title}>
              <div className="plan-matrix-row is-subheader">
                <div className="plan-matrix-cell" style={{ gridColumn: "1 / -1" }}>
                  <span>{group.title}</span>
                </div>
              </div>
              {group.rows.map((row) => (
                <div className="plan-matrix-row" key={row.feature}>
                  <div className="plan-matrix-cell">
                    <span>{row.feature}</span>
                  </div>
                  <MatrixValue value={row.free} />
                  <MatrixValue value={row.pro} />
                  <MatrixValue value={row.ultra} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="plan-faq-grid">
        {FAQ.map((item) => {
          const Icon = item.icon;
          return (
            <div className="plan-faq-card" key={item.title}>
              <Icon size={20} aria-hidden="true" />
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          );
        })}
      </div>

      <div className="plan-foot">
        <div>
          <p className="eyebrow">Stack details</p>
          <h2>What you actually get</h2>
          <p>
            Every tier runs on the same security spine — heuristic vetoes, SIWE-scoped sessions,
            and live ground-truth checks against audits, exploits, and TVL crashes. Higher tiers
            broaden the AI panel and unlock the deeper analytics surface.
          </p>
        </div>
        <ul className="plan-foot-list">
          <li>
            <Bot size={18} aria-hidden="true" />
            <div>
              <strong>Strategist depth scales with your tier</strong>
              <span>
                Free runs a solo strategist. Pro pairs two strategists in cross-review.
                Ultra activates the full council — three strategists with synthesis + veto.
              </span>
            </div>
          </li>
          <li>
            <Bell size={18} aria-hidden="true" />
            <div>
              <strong>Real-time monitoring</strong>
              <span>
                APY drops, TVL drains, exploit feeds, deployer downgrades — Pro &amp; Ultra
                fire alerts the moment ground-truth changes.
              </span>
            </div>
          </li>
          <li>
            <Radio size={18} aria-hidden="true" />
            <div>
              <strong>Multi-channel delivery</strong>
              <span>
                Ultra fans alerts to Email, Slack, Telegram, and SMS in addition to Discord —
                so the right person gets the right ping.
              </span>
            </div>
          </li>
        </ul>
        <div className="plan-foot-cta">
          <Link href="/strategies" className="secondary-button">
            Try the strategy engine
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href="mailto:hello@sovereign-terminal.com?subject=Sovereign%20pricing"
            className="ghost-button"
          >
            Talk to us
          </Link>
        </div>
      </div>
    </div>
  );
}

function MatrixValue({ value }: { value: MatrixCell }) {
  if (value === true) {
    return (
      <div className="plan-matrix-cell">
        <Check size={16} aria-hidden="true" className="matrix-yes" />
        <span className="matrix-yes-label">Included</span>
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="plan-matrix-cell">
        <Minus size={16} aria-hidden="true" className="matrix-no" />
        <span className="matrix-no-label">Not included</span>
      </div>
    );
  }
  return (
    <div className="plan-matrix-cell">
      <span>{value}</span>
    </div>
  );
}
