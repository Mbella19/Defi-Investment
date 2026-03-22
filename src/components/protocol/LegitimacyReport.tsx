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
      ? "text-[#00D4AA]"
      : score >= 40
        ? "text-[#7a8200]"
        : "text-[#ff4d4d]";

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
    <div className="bg-[#f2f3f5] border border-[#d7dade] hover:border-[#00D4AA]/30 hover:-translate-y-0.5 p-8 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-headline text-lg font-black text-[#203241]">{section.title}</h4>
        <ScoreGauge score={section.score} size="sm" />
      </div>
      <p className="text-[#6b7781] text-[12px] leading-relaxed mb-4">
        {section.assessment}
      </p>
      <ul className="space-y-1">
        {section.keyFindings.map((finding, i) => (
          <li key={i} className="text-[11px] text-[#43515d] flex items-start gap-2">
            <span className="text-[#00D4AA] mt-0.5">&#8226;</span>
            {finding}
          </li>
        ))}
      </ul>
    </div>
  );
}

const verdictStyles: Record<string, { label: string; bg: string; text: string }> = {
  high_confidence: { label: "High Confidence", bg: "bg-[#00D4AA]/10", text: "text-[#00896e]" },
  moderate_confidence: { label: "Moderate Confidence", bg: "bg-[#dce61a]/20", text: "text-[#7a8200]" },
  low_confidence: { label: "Low Confidence", bg: "bg-[#ff6c12]/10", text: "text-[#ff6c12]" },
  caution: { label: "Caution", bg: "bg-[#ff4d4d]/10", text: "text-[#ff4d4d]" },
};

export default function LegitimacyReport({ analysis }: LegitimacyReportProps) {
  const verdict = verdictStyles[analysis.overallVerdict] || verdictStyles.caution;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Overall Score */}
      <div className="bg-white border border-[#d7dade] p-8 flex flex-col md:flex-row items-start md:items-center gap-8 transition-all duration-300">
        <ScoreGauge score={analysis.legitimacyScore} size="lg" />
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-[#00D4AA]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#45515d]/70">
              Intelligence Verdict
            </span>
          </div>
          <span className={`inline-block px-4 py-1.5 ${verdict.bg} ${verdict.text} text-[11px] font-semibold tracking-[0.15em] uppercase mb-3`}>
            {verdict.label}
          </span>
          <p className="text-[#6b7781] text-sm leading-relaxed mt-2 max-w-2xl">
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
          <div className="bg-[#ff4d4d]/5 border border-[#ff4d4d]/10 p-8 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-[#ff4d4d]" />
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#ff4d4d]">
                Red Flags
              </h4>
            </div>
            <ul className="space-y-2">
              {analysis.redFlags.map((flag, i) => (
                <li key={i} className="text-[12px] text-[#43515d] flex items-start gap-2">
                  <span className="text-[#ff4d4d] mt-0.5">&#9888;</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.positiveSignals.length > 0 && (
          <div className="bg-[#00D4AA]/5 border border-[#00D4AA]/10 p-8 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-[#00D4AA]" />
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00896e]">
                Positive Signals
              </h4>
            </div>
            <ul className="space-y-2">
              {analysis.positiveSignals.map((signal, i) => (
                <li key={i} className="text-[12px] text-[#43515d] flex items-start gap-2">
                  <span className="text-[#00D4AA] mt-0.5">&#10003;</span>
                  {signal}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Investment Considerations */}
      {analysis.investmentConsiderations.length > 0 && (
        <div className="bg-[#dce61a]/10 border border-[#dce61a]/20 p-8 transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-[#7a8200]" />
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7a8200]">
              Investment Considerations
            </h4>
          </div>
          <ul className="space-y-3">
            {analysis.investmentConsiderations.map((item, i) => (
              <li key={i} className="text-[12px] text-[#43515d] flex items-start gap-3">
                <span className="text-[#7a8200] font-bold">{i + 1}.</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <div className="border-t border-[#d7dade] pt-8 text-center">
        <p className="text-[10px] text-[#6b7781]">
          This analysis is AI-generated and for informational purposes only. It is not financial
          advice. Always do your own research before investing. Analysis generated at{" "}
          {new Date(analysis.analyzedAt).toLocaleString()}.
        </p>
      </div>
    </div>
  );
}
