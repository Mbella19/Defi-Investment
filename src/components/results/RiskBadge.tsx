import type { RiskAppetite } from "@/types/scanner";

interface RiskBadgeProps {
  risk: RiskAppetite;
}

const riskStyles: Record<RiskAppetite, { bg: string; text: string; label: string }> = {
  low: {
    bg: "bg-[#00D4AA]/10",
    text: "text-[#00896e]",
    label: "Low Risk",
  },
  medium: {
    bg: "bg-[#dce61a]/20",
    text: "text-[#7a8200]",
    label: "Medium Risk",
  },
  high: {
    bg: "bg-[#ff4d4d]/10",
    text: "text-[#ff4d4d]",
    label: "High Risk",
  },
};

export default function RiskBadge({ risk }: RiskBadgeProps) {
  const style = riskStyles[risk];
  return (
    <span
      className={`inline-block px-3 py-1 ${style.bg} ${style.text} text-[10px] font-semibold tracking-[0.15em] uppercase`}
    >
      {style.label}
    </span>
  );
}
