import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "stroke"> & { size?: number; stroke?: number };

const base = (p: IconProps) => ({
  width: p.size ?? 16,
  height: p.size ?? 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: p.stroke ?? 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

const strip = ({ size: _s, stroke: _st, ...rest }: IconProps) => rest;

export const Icons = {
  home: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  compass: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </svg>
  ),
  wallet: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M16 13h3" />
      <path d="M3 9h15a2 2 0 012 2" />
    </svg>
  ),
  shield: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    </svg>
  ),
  tools: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M14.7 6.3a4 4 0 00-5.6 5.6l-6.1 6.1a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l6.1-6.1a4 4 0 005.6-5.6l-2.5 2.5-2.1-2.1z" />
    </svg>
  ),
  settings: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 00.3 1.7l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.7-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.7.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.7 1.6 1.6 0 00-1.5-1H3a2 2 0 010-4h.1A1.6 1.6 0 004.6 9a1.6 1.6 0 00-.3-1.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.7.3H9a1.6 1.6 0 001-1.5V3a2 2 0 014 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.7-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.7V9a1.6 1.6 0 001.5 1H21a2 2 0 010 4h-.1a1.6 1.6 0 00-1.5 1z" />
    </svg>
  ),
  search: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  arrow: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  ),
  arrowUp: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M7 14l5-5 5 5" />
    </svg>
  ),
  arrowDn: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M7 10l5 5 5-5" />
    </svg>
  ),
  bell: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" />
      <path d="M10 21a2 2 0 004 0" />
    </svg>
  ),
  filter: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M3 5h18l-7 9v6l-4-2v-4z" />
    </svg>
  ),
  plus: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  x: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  check: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M5 12l4 4 10-10" />
    </svg>
  ),
  chevR: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  chevD: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  menu: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  ),
  sun: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  moon: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
    </svg>
  ),
  zap: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
    </svg>
  ),
  trend: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  ),
  external: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5" />
    </svg>
  ),
  lock: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  ),
  activity: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </svg>
  ),
  pie: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M21 12A9 9 0 1112 3v9z" />
    </svg>
  ),
  coins: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <circle cx="8" cy="8" r="5" />
      <path d="M3 18a5 5 0 005 5c1.5 0 2.8-.6 3.8-1.7" />
      <path d="M10.7 10.8A5 5 0 1121 13c-.2 1.3-.8 2.5-1.7 3.4" />
    </svg>
  ),
  globe: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
    </svg>
  ),
  alert: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M12 2l10 18H2z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  ),
  info: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v4h1" />
    </svg>
  ),
  eye: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  copy: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  ),
  download: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  ),
  // Legacy names kept so existing call-sites don't break until they're touched
  terminal: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M4 6l5 5-5 5M13 17h7" />
    </svg>
  ),
  orbit: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-20 12 12)" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  ),
  vault: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="15" cy="12" r="3" />
      <path d="M15 8v1M15 15v1M18 12h1M11 12h1" />
    </svg>
  ),
  portfolio: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 9h15a2 2 0 012 2" />
      <path d="M16 13h3" />
    </svg>
  ),
  risk: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M12 2l10 18H2L12 2z" />
      <path d="M12 9v5M12 17v.5" />
    </svg>
  ),
  monitor: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  ),
  dot: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  ),
  wave: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M14.7 6.3a4 4 0 00-5.6 5.6l-6.1 6.1a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l6.1-6.1a4 4 0 005.6-5.6l-2.5 2.5-2.1-2.1z" />
    </svg>
  ),
  refresh: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M21 12a9 9 0 11-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  ),
  close: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  brain: (p: IconProps) => (
    <svg {...base(p)} {...strip(p)}>
      <path d="M9 3a3 3 0 00-3 3v1a3 3 0 00-2 5 3 3 0 001 5 3 3 0 004 3 3 3 0 004 0 3 3 0 004-3 3 3 0 001-5 3 3 0 00-2-5V6a3 3 0 00-3-3 3 3 0 00-2 1 3 3 0 00-2-1z" />
      <path d="M9 10h.01M15 10h.01" />
    </svg>
  ),
};
