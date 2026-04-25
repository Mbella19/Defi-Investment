"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Icons } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

const ConnectButton = dynamic(
  () => import("@/components/wallet/ConnectButton"),
  {
    ssr: false,
    loading: () => (
      <button
        className="btn btn-primary btn-sm"
        style={{ opacity: 0.6, pointerEvents: "none" }}
        type="button"
      >
        Connect wallet
      </button>
    ),
  },
);

const AlertBell = dynamic(() => import("@/components/notifications/AlertBell"), {
  ssr: false,
});

const CRUMBS: Record<string, string[]> = {
  "/": ["Home"],
  "/discover": ["Home", "Discover"],
  "/portfolio": ["Home", "Portfolio"],
  "/security": ["Home", "Security"],
  "/tools": ["Home", "Tools"],
};

function crumbsFor(pathname: string): string[] {
  if (CRUMBS[pathname]) return CRUMBS[pathname];
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  if (!seg) return ["Home"];
  return ["Home", seg.charAt(0).toUpperCase() + seg.slice(1)];
}

export function Topbar({ extra }: { extra?: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const breadcrumb = crumbsFor(pathname);

  return (
    <header
      className="sovereign-topbar"
      style={{
        height: 60,
        padding: "0 24px",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--line)",
        background: "var(--glass-bg)",
        backdropFilter: "blur(var(--glass-blur))",
        WebkitBackdropFilter: "blur(var(--glass-blur))",
        position: "sticky",
        top: 0,
        zIndex: 30,
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {breadcrumb.map((seg, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            {i > 0 ? <Icons.chevR size={12} style={{ color: "var(--text-muted)" }} /> : null}
            <span
              style={{
                fontSize: 13.5,
                color: i === breadcrumb.length - 1 ? "var(--text)" : "var(--text-dim)",
                fontWeight: i === breadcrumb.length - 1 ? 500 : 400,
              }}
            >
              {seg}
            </span>
          </span>
        ))}
        {extra}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button
          type="button"
          className="topbar-search hide-lt-1100"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 12px",
            borderRadius: 10,
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            width: 280,
            color: "var(--text-dim)",
            fontSize: 12.5,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Icons.search size={14} />
          <span>Search pools, tokens, chains…</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
            <kbd
              className="mono"
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 5,
                background: "var(--surface)",
                border: "1px solid var(--line-2)",
                color: "var(--text-2)",
              }}
            >
              ⌘K
            </kbd>
          </span>
        </button>
        <ThemeToggle />
        <AlertBell />
        <ConnectButton />
      </div>
    </header>
  );
}

export default Topbar;
