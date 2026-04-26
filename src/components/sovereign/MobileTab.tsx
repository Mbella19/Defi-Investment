"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "./Icons";

type Item = {
  href: string;
  label: string;
  icon: (props: { size?: number; stroke?: number }) => React.ReactElement;
  match?: (p: string) => boolean;
};

const items: Item[] = [
  { href: "/", label: "Home", icon: Icons.home, match: (p) => p === "/" },
  { href: "/discover", label: "Discover", icon: Icons.compass },
  { href: "/portfolio", label: "Portfolio", icon: Icons.wallet },
  { href: "/security/audit", label: "Security", icon: Icons.shield },
  { href: "/tools", label: "Tools", icon: Icons.tools },
];

function active(it: Item, p: string) {
  if (it.match) return it.match(p);
  return p === it.href || p.startsWith(`${it.href}/`);
}

export function MobileTab() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="mobile-tab" aria-label="Primary">
      {items.map((it) => {
        const Ic = it.icon;
        const on = active(it, pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`mobile-tab-item${on ? " active" : ""}`}
            aria-current={on ? "page" : undefined}
          >
            <span className="badge">
              <Ic size={18} stroke={on ? 2 : 1.5} />
            </span>
            <span className="lbl">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default MobileTab;
