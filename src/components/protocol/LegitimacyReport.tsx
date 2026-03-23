"use client";

import type { ProtocolAnalysis, AnalysisSection } from "@/types/analysis";

interface LegitimacyReportProps {
  analysis: ProtocolAnalysis;
}

function ScoreGauge({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const radius = size === "lg" ? 48 : 24;
  const strokeWidth = size === "lg" ? 4 : 3;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const svgSize = (radius + strokeWidth) * 2;

  const color =
    score >= 70
      ? "text-accent"
      : score >= 40
        ? "text-[#7a8200]"
        : "text-danger";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={svgSize} height={svgSize} className="-rotate-90">
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-[#d7dade]"
        />
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          strokeLinecap="square"
          className={color}
        />
      </svg>
      <span
        className={`absolute ${size === "lg" ? "font-headline text-4xl font-black" : "text-xs font-bold"} ${color}`}
      >
        {score}
      </span>
    </div>
  );
}

function SectionCard({ section }: { section: AnalysisSection }) {
  return (
    <div className="bg-surface-low border border-outline hover:border-accent/30 hover:-translate-y-0.5 p-8 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-headline text-lg font-black text-on-surface">{section.title}</h4>
        <ScoreGauge score={section.score} size="sm" />
      </div>
      <p className="text-muted text-sm leading-relaxed mb-4">
        {section.assessment}
      </p>
      <ul className="space-y-1">
        {section.keyFindings.map((finding, i) => (
          <li key={i} className="text-[13px] text-on-surface-variant flex items-start gap-2">
            <span className="text-accent mt-0.5">&#8226;</span>
            {finding}
          </li>
        ))}
      </ul>
    </div>
  );
}

const verdictStyles: Record<string, { label: string; bg: string; text: string }> = {
  high_confidence: { label: "High Confidence", bg: "bg-accent/10", text: "text-accent" },
  moderate_confidence: { label: "Moderate Confidence", bg: "bg-lime/20", text: "text-[#7a8200]" },
  low_confidence: { label: "Low Confidence", bg: "bg-cta/10", text: "text-cta" },
  caution: { label: "Caution", bg: "bg-danger/10", text: "text-danger" },
};

export default function LegitimacyReport({ analysis }: LegitimacyReportProps) {
  const verdict = verdictStyles[analysis.overallVerdict] || verdictStyles.caution;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Overall Score */}
      <div className="bg-surface-highest border border-outline p-8 flex flex-col md:flex-row items-start md:items-center gap-8 transition-all duration-300">
        <ScoreGauge score={analysis.legitimacyScore} size="lg" />
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-accent" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
              Intelligence Verdict
            </span>
          </div>
          <span className={`inline-block px-4 py-1.5 ${verdict.bg} ${verdict.text} text-[13px] font-semibold tracking-[0.12em] uppercase mb-3`}>
            {verdict.label}
          </span>
          <p className="text-muted text-sm leading-relaxed mt-2 max-w-2xl">
            {analysis.summary}
          </p>
        </div>
      </div>

      {/* Section Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard section={analysis.sections.auditHistory} />
        <SectionCard section={analysis.sections.teamReputation} />
        <SectionCard section={analysis.sections.tvlAnalysis} />
        <SectionCard section={analysis.sections.smartContractRisk} />
        <SectionCard section={analysis.sections.protocolMaturity} />
        <SectionCard section={analysis.sections.communityGovernance} />
      </div>

      {/* Red Flags & Positive Signals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {analysis.redFlags.length > 0 && (
          <div className="bg-danger/5 border border-danger/10 p-8 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-danger" />
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-danger">
                Red Flags
              </h4>
            </div>
            <ul className="space-y-2">
              {analysis.redFlags.map((flag, i) => (
                <li key={i} className="text-sm text-on-surface-variant flex items-start gap-2">
                  <span className="text-danger mt-0.5">&#9888;</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.positiveSignals.length > 0 && (
          <div className="bg-accent/5 border border-accent/10 p-8 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-accent" />
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">
                Positive Signals
              </h4>
            </div>
            <ul className="space-y-2">
              {analysis.positiveSignals.map((signal, i) => (
                <li key={i} className="text-sm text-on-surface-variant flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#10003;</span>
                  {signal}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Investment Considerations */}
      {analysis.investmentConsiderations.length > 0 && (
        <div className="bg-lime/10 border border-[#dce61a]/20 p-8 transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-[#7a8200]" />
            <h4 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-[#7a8200]">
              Investment Considerations
            </h4>
          </div>
          <ul className="space-y-3">
            {analysis.investmentConsiderations.map((item, i) => (
              <li key={i} className="text-sm text-on-surface-variant flex items-start gap-3">
                <span className="text-[#7a8200] font-bold">{i + 1}.</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <div className="border-t border-outline pt-8 text-center">
        <p className="text-xs text-muted">
          This analysis is AI-generated and for informational purposes only. It is not financial
          advice. Always do your own research before investing. Analysis generated at{" "}
          {new Date(analysis.analyzedAt).toLocaleString()}.
        </p>
      </div>
    </div>
  );
}
