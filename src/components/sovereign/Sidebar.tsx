"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "./Icons";

type NavItem = {
  href: string;
  label: string;
  match?: (pathname: string) => boolean;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
};

const primary: NavItem[] = [
  { href: "/", label: "HOME", icon: Icons.dot, match: (p) => p === "/" },
  { href: "/discover", label: "DISCOVER", icon: Icons.search },
  { href: "/portfolio", label: "PORTFOLIO", icon: Icons.portfolio },
  { href: "/security", label: "SECURITY", icon: Icons.shield },
  { href: "/tools", label: "TOOLS", icon: Icons.wave },
];

function isActive(item: NavItem, pathname: string) {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-logo" aria-label="Sovereign home">
        SIG
      </Link>
      <div className="sidebar-nav">
        {primary.map((it) => {
          const active = isActive(it, pathname);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`sidebar-item ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon />
              <span className="tip">{it.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="sidebar-item" style={{ color: "var(--text-muted)" }}>
        <Icons.settings />
        <span className="tip">SETTINGS</span>
      </div>
    </aside>
  );
}

export default Sidebar;
