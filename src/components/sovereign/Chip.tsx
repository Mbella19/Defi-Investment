import type { ReactNode } from "react";

type ChipKind = "default" | "good" | "warn" | "danger" | "accent";

type ChipProps = {
  children: ReactNode;
  kind?: ChipKind;
  className?: string;
};

export function Chip({ children, kind = "default", className = "" }: ChipProps) {
  const extra = kind === "default" ? "" : kind;
  return <span className={`chip ${extra} ${className}`}>{children}</span>;
}

export default Chip;
