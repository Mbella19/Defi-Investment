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
    "inline-flex items-center justify-center gap-2 text-[10px] uppercase font-bold tracking-widest transition-all duration-200";

  const variantClasses = {
    primary: "bg-primary text-on-primary px-6 py-3 hover:bg-primary-dim",
    ghost: "bg-transparent text-on-surface px-6 py-3 hover:bg-surface-high",
    outline:
      "bg-transparent border border-outline text-on-surface px-6 py-3 hover:bg-on-surface hover:text-background",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${disabled ? "opacity-40 pointer-events-none" : ""} ${className}`;

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
