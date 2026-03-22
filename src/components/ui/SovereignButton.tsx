"use client";

interface SovereignButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "outline";
  icon?: string;
  className?: string;
  onClick?: () => void;
  href?: string;
  target?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}

export default function SovereignButton({
  children,
  variant = "primary",
  icon,
  className = "",
  onClick,
  href,
  target,
  disabled = false,
  type = "button",
}: SovereignButtonProps) {
  const baseClasses =
    "group inline-flex items-center justify-center gap-3 text-[12px] uppercase font-semibold tracking-[0.08em] transition-all duration-300";

  const variantClasses = {
    primary: "bg-[#ff6c12] text-white px-8 py-4 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(255,108,18,0.28)]",
    ghost: "bg-transparent text-[#2a3a46] px-6 py-3 hover:opacity-60",
    outline:
      "bg-transparent border border-[#2a3a46] text-[#2a3a46] px-8 py-4 hover:-translate-y-0.5 hover:bg-[#2a3a46] hover:text-white",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${disabled ? "opacity-30 pointer-events-none" : ""} ${className}`;

  if (href) {
    return (
      <a href={href} target={target} rel={target === "_blank" ? "noopener noreferrer" : undefined} className={classes}>
        {icon && <span className="material-symbols-outlined text-sm">{icon}</span>}
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {icon && <span className="material-symbols-outlined text-sm">{icon}</span>}
      {children}
    </button>
  );
}
