"use client";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export default function GlassCard({ children, className = "", hover = true, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-surface-low ghost-border transition-all duration-300
        ${hover ? "hover:bg-surface-high ghost-border-hover cursor-pointer" : ""}
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
