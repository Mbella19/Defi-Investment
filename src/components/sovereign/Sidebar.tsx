"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "./Icons";
import { Monogram } from "./Monogram";

type NavItem = {
  href: string;
  label: string;
  match?: (pathname: string) => boolean;
  icon: (props: { size?: number; stroke?: number }) => React.ReactElement;
};

const nav: NavItem[] = [
  { href: "/", label: "Home", icon: Icons.home, match: (p) => p === "/" },
  { href: "/discover", label: "Discover", icon: Icons.compass },
  { href: "/portfolio", label: "Portfolio", icon: Icons.wallet },
  { href: "/security", label: "Security", icon: Icons.shield },
  { href: "/tools", label: "Tools", icon: Icons.tools },
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  return (
    <aside className="sidebar">
      <Link
        href="/"
        className="sidebar-brand"
        style={{ textDecoration: "none", color: "var(--text)" }}
        aria-label="Sovereign home"
      >
        <Monogram size={34} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.08, minWidth: 0 }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.015em" }}>Sovereign</span>
          <span
            className="mono"
            style={{ fontSize: 9.5, color: "var(--text-dim)", letterSpacing: "0.12em", marginTop: 2 }}
          >
            INVESTMENT GROUP
          </span>
        </div>
      </Link>

      <nav className="sidebar-nav">
        <div className="eyebrow" style={{ fontSize: 9.5, padding: "4px 10px 10px" }}>
          NAVIGATE
        </div>
        {nav.map((it) => {
          const Icon = it.icon;
          const active = isActive(it, pathname);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`sidebar-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={16} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          padding: 14,
          borderRadius: 14,
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <span className="dot accent pulse-dot" />
          <span
            className="mono"
            style={{ fontSize: 10, color: "var(--text-2)", letterSpacing: "0.12em" }}
          >
            LIVE · DEFILLAMA
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.45 }}>
          Data refreshed every block.
          <br />
          Scoring is open-source.
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
