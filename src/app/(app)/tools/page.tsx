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
    body: "Forward-replay an allocation against baseline, depeg, TVL crash, and market drawdown using real DeFiLlama history.",
    metric: "4 regimes",
  },
  {
    title: "Correlation matrix",
    href: "/tools/correlation",
    icon: CircleDollarSign,
    body: "Pearson correlation across up to 12 live pools (day-over-day APY changes) — find crowded exposure before sizing capital.",
    metric: "≤12 pools",
  },
  {
    title: "Contract review",
    href: "/security/audit",
    icon: TriangleAlert,
    body: "Six-engine smart-contract review with triple-AI synthesis and SCSVS mapping. Heuristic vetoes still apply.",
    metric: "6 engines",
  },
  {
    title: "Portfolio lens",
    href: "/portfolio",
    icon: Coins,
    body: "Connect a wallet for read-only chain, asset, and strategy exposure across the supported networks.",
    metric: "7 chains",
  },
];

export default function ToolsHubPage() {
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Tools</p>
          <h1>Models for pre-trade judgment.</h1>
          <p>
            Stress assumptions, check diversification, and push contract reviews into the
            same decision surface.
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

      <SectionHeader eyebrow="Workspace" title="Choose a model." />
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
