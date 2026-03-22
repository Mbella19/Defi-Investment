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
        bg-[#f2f3f5] border border-[#d7dade] transition-all duration-300
        ${hover ? "hover:-translate-y-0.5 hover:border-[#00D4AA]/30 hover:shadow-[0_8px_24px_rgba(0,212,170,0.06)] cursor-pointer" : ""}
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
