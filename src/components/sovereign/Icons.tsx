import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Icons = {
  terminal: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
      <path d="M4 6l5 5-5 5M13 17h7" />
    </svg>
  ),
  orbit: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-20 12 12)" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  ),
  vault: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
      <rect x="3" y="4" width="18" height="16" />
      <circle cx="15" cy="12" r="3" />
      <path d="M15 8v1M15 15v1M18 12h1M11 12h1" />
    </svg>
  ),
  portfolio: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
      <path d="M3 3v18h18M7 14l4-4 4 4 5-7" />
    </svg>
  ),
  risk: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
      <path d="M12 2l10 18H2L12 2z" />
      <path d="M12 9v5M12 17v.5" />
    </svg>
  ),
  monitor: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  ),
  arrow: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="14" height="14" {...base} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  plus: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="12" height="12" {...base} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  dot: (p: IconProps) => (
    <svg viewBox="0 0 8 8" width="8" height="8" {...p}>
      <circle cx="4" cy="4" r="3" fill="currentColor" />
    </svg>
  ),
  chev: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="12" height="12" {...base} {...p}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  search: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="14" height="14" {...base} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  ),
  bell: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="14" height="14" {...base} {...p}>
      <path d="M6 16V10a6 6 0 1 1 12 0v6l2 2H4l2-2zM9 20a3 3 0 0 0 6 0" />
    </svg>
  ),
  settings: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="14" height="14" {...base} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8L7 17M17 7l2.8-2.8" />
    </svg>
  ),
  brain: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
      <path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-3 3 3 3 0 0 0 1.5 2.6A3 3 0 0 0 3 14a3 3 0 0 0 3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zM15 3a3 3 0 0 1 3 3 3 3 0 0 1 3 3 3 3 0 0 1-1.5 2.6A3 3 0 0 1 21 14a3 3 0 0 1-3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" />
    </svg>
  ),
  shield: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    </svg>
  ),
  wave: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
      <path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0 4 4 6 0" />
    </svg>
  ),
  close: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="14" height="14" {...base} {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  check: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="14" height="14" {...base} {...p}>
      <path d="M4 12l5 5 11-11" />
    </svg>
  ),
  download: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="14" height="14" {...base} {...p}>
      <path d="M12 3v12M6 11l6 6 6-6M4 21h16" />
    </svg>
  ),
  refresh: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="14" height="14" {...base} {...p}>
      <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
    </svg>
  ),
  power: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="14" height="14" {...base} {...p}>
      <path d="M12 3v10M6 6a9 9 0 1 0 12 0" />
    </svg>
  ),
};

export default Icons;
