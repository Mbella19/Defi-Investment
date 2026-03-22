import type { RiskAppetite } from "@/types/scanner";

interface RiskBadgeProps {
  risk: RiskAppetite;
}

const riskStyles: Record<RiskAppetite, { bg: string; text: string; label: string }> = {
  low: {
    bg: "bg-secondary-container",
    text: "text-on-secondary-container",
    label: "Low Risk",
  },
  medium: {
    bg: "bg-outline-variant/20",
    text: "text-on-surface-variant",
    label: "Medium Risk",
  },
  high: {
    bg: "bg-error-container",
    text: "text-on-error-container",
    label: "High Risk",
  },
};

export default function RiskBadge({ risk }: RiskBadgeProps) {
  const style = riskStyles[risk];
  return (
    <span
      className={`inline-block px-2 py-0.5 ${style.bg} ${style.text} text-[8px] font-bold tracking-tighter uppercase`}
    >
      {style.label}
    </span>
  );
}
