import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  Coins,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { CommandStrip, SectionHeader } from "@/components/site/ui";

const toolCards = [
  {
    title: "Scenario simulator",
    href: "/tools/simulator",
    icon: Sparkles,
    body: "Forward-replay any allocation against four real-world stress regimes — baseline, stablecoin depeg, TVL crash, and market drawdown — using each protocol's own historical yield data. Find out how your portfolio behaves before the market makes you find out.",
    metric: "4 regimes",
  },
  {
    title: "Correlation matrix",
    href: "/tools/correlation",
    icon: CircleDollarSign,
    body: "See where your positions secretly move together. Crowded exposure is the silent portfolio killer — we surface it before you size up so you can hold real diversification, not the appearance of it.",
    metric: "Live cross-asset",
  },
  {
    title: "Contract review",
    href: "/security/audit",
    icon: TriangleAlert,
    body: "Institutional-grade security review on any verified contract — source, on-chain state, governance, deployer history — mapped to industry standards and delivered in minutes. Free gets 2 a month; Pro gets 20; Ultra is unlimited.",
    metric: "Verdict in minutes",
  },
  {
    title: "Portfolio lens",
    href: "/portfolio",
    icon: Coins,
    body: "Read-only view of every DeFi position you hold across every supported chain. We never request approvals; we just watch — and fold the picture into the same decision surface as everything else.",
    metric: "7 chains",
  },
];

export default function ToolsHubPage() {
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Tools</p>
          <h1>Models for pre-trade conviction.</h1>
          <p>
            Stress-test allocations, surface hidden exposure, and run contract reviews —
            all in the same workspace where you decide where capital goes. Built so you
            never deploy on a hunch.
          </p>
        </div>
      </div>

      <CommandStrip
        file="file/06.tools"
        items={[
          { label: "models", value: "scenario ready", tone: "ok" },
          { label: "matrix", value: "correlation live", tone: "info" },
          { label: "audit", value: "same surface", tone: "warn" },
        ]}
      />

      <SectionHeader eyebrow="Workspace" title="Pick your lens." />
      <div className="tool-grid">
        {toolCards.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link href={tool.href} className="tool-card" key={tool.title}>
              <div>
                <div className="tool-icon">
                  <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <h3>{tool.title}</h3>
                <p>{tool.body}</p>
              </div>
              <footer>
                <span>{tool.metric}</span>
                <ArrowRight size={17} aria-hidden="true" />
              </footer>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
