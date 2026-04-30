"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  CircleGauge,
  Crown,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { BrandMark } from "@/components/site/BrandMark";
import { PixelField } from "@/components/site/PixelField";
import { SocialIcon, type SocialIconId } from "@/components/site/SocialIcon";
import { WalletButton } from "@/components/site/WalletButton";

// Existing AlertBell pulls live alerts from /api/strategies/alerts via the
// authed cookie. Lazy-load it to avoid SSR churn.
const AlertBell = dynamic(() => import("@/components/notifications/AlertBell"), {
  ssr: false,
});

const nav = [
  { href: "/discover", label: "Markets", icon: Search },
  { href: "/portfolio", label: "Portfolio", icon: WalletCards },
  { href: "/strategies", label: "Strategy", icon: Sparkles },
  { href: "/security/audit", label: "Security", icon: ShieldCheck },
  { href: "/plans", label: "Plans", icon: Crown },
  { href: "/tools", label: "More", icon: CircleGauge },
];

const socialLinks: Array<{ label: string; href: string; icon: SocialIconId }> = [
  { label: "Discord", href: "https://discord.com", icon: "discord" },
  { label: "Twitter", href: "https://twitter.com", icon: "twitter" },
  { label: "GitHub", href: "https://github.com", icon: "github" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  return (
    <div className="site-shell">
      <PixelField />
      <header className="top-nav">
        <Link href="/" className="brand-link" onClick={() => setOpen(false)}>
          <BrandMark />
        </Link>

        <nav className="nav-links" aria-label="Primary navigation">
          {nav.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : ""}>
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="nav-actions">
          {socialLinks.map((item) => (
            <a
              className="icon-button nav-social"
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.label}
              key={item.label}
            >
              <SocialIcon id={item.icon} size={28} />
            </a>
          ))}
          <span className="alert-slot">
            <AlertBell />
          </span>
          <span className="connect-slot">
            <WalletButton />
          </span>
          <button className="menu-button" type="button" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      {open ? (
        <div className="mobile-menu">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}

      <main>{children}</main>
    </div>
  );
}
