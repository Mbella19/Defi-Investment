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
      ? "text-primary"
      : score >= 40
        ? "text-secondary"
        : "text-error";

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
          className="text-surface-highest"
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
        className={`absolute ${size === "lg" ? "text-2xl font-headline" : "text-xs font-label font-bold"} ${color}`}
      >
        {score}
      </span>
    </div>
  );
}

function SectionCard({ section }: { section: AnalysisSection }) {
  return (
    <div className="bg-surface-low ghost-border ghost-border-hover p-6 transition-all duration-300 hover:bg-surface-high">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-headline text-lg text-on-surface">{section.title}</h4>
        <ScoreGauge score={section.score} size="sm" />
      </div>
      <p className="text-on-surface-variant text-[12px] leading-relaxed mb-4">
        {section.assessment}
      </p>
      <ul className="space-y-1">
        {section.keyFindings.map((finding, i) => (
          <li key={i} className="text-[11px] text-on-surface-variant flex items-start gap-2">
            <span className="text-primary mt-0.5">&#8226;</span>
            {finding}
          </li>
        ))}
      </ul>
    </div>
  );
}

const verdictLabels: Record<string, { label: string; color: string }> = {
  high_confidence: { label: "High Confidence", color: "text-primary" },
  moderate_confidence: { label: "Moderate Confidence", color: "text-secondary" },
  low_confidence: { label: "Low Confidence", color: "text-error-dim" },
  caution: { label: "Caution", color: "text-error" },
};

export default function LegitimacyReport({ analysis }: LegitimacyReportProps) {
  const verdict = verdictLabels[analysis.overallVerdict] || verdictLabels.caution;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Overall Score */}
      <div className="bg-surface-lowest p-10 border-l-4 border-primary flex flex-col md:flex-row items-start md:items-center gap-8">
        <ScoreGauge score={analysis.legitimacyScore} size="lg" />
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-on-surface-variant mb-2 block">
            Intelligence Verdict
          </span>
          <h3 className={`font-headline text-3xl ${verdict.color}`}>{verdict.label}</h3>
          <p className="text-on-surface-variant text-sm leading-relaxed mt-2 max-w-2xl">
            {analysis.summary}
          </p>
        </div>
      </div>

      {/* Section Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-surface">
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
          <div className="bg-surface-low border-l-4 border-error p-6">
            <h4 className="text-[10px] uppercase tracking-widest font-bold text-error mb-4">
              Red Flags
            </h4>
            <ul className="space-y-2">
              {analysis.redFlags.map((flag, i) => (
                <li key={i} className="text-[12px] text-on-surface-variant flex items-start gap-2">
                  <span className="text-error mt-0.5">&#9888;</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.positiveSignals.length > 0 && (
          <div className="bg-surface-low border-l-4 border-primary p-6">
            <h4 className="text-[10px] uppercase tracking-widest font-bold text-primary mb-4">
              Positive Signals
            </h4>
            <ul className="space-y-2">
              {analysis.positiveSignals.map((signal, i) => (
                <li key={i} className="text-[12px] text-on-surface-variant flex items-start gap-2">
                  <span className="text-primary mt-0.5">&#10003;</span>
                  {signal}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Investment Considerations */}
      {analysis.investmentConsiderations.length > 0 && (
        <div className="bg-surface-lowest p-8 border-l-4 border-secondary">
          <h4 className="text-[10px] uppercase tracking-widest font-bold text-secondary mb-4">
            Investment Considerations
          </h4>
          <ul className="space-y-3">
            {analysis.investmentConsiderations.map((item, i) => (
              <li key={i} className="text-[12px] text-on-surface-variant flex items-start gap-3">
                <span className="text-secondary font-bold">{i + 1}.</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-surface-container p-4 text-center">
        <p className="text-[10px] text-on-surface-variant">
          This analysis is AI-generated and for informational purposes only. It is not financial
          advice. Always do your own research before investing. Analysis generated at{" "}
          {new Date(analysis.analyzedAt).toLocaleString()}.
        </p>
      </div>
    </div>
  );
}
