import type { RiskAppetite } from "@/types/scanner";

interface RiskBadgeProps {
  risk: RiskAppetite;
}

const riskStyles: Record<RiskAppetite, { bg: string; text: string; label: string }> = {
  low: {
    bg: "bg-accent/10",
    text: "text-accent",
    label: "Low Risk",
  },
  medium: {
    bg: "bg-lime/20",
    text: "text-[#7a8200]",
    label: "Medium Risk",
  },
  high: {
    bg: "bg-danger/10",
    text: "text-danger",
    label: "High Risk",
  },
};

export default function RiskBadge({ risk }: RiskBadgeProps) {
  const style = riskStyles[risk];
  return (
    <span
      className={`inline-block px-3 py-1 ${style.bg} ${style.text} text-xs font-semibold tracking-[0.12em] uppercase`}
    >
      {style.label}
    </span>
  );
}
