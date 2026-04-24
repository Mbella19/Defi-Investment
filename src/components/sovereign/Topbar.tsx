"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

const ConnectButton = dynamic(
  () => import("@/components/wallet/ConnectButton"),
  {
    ssr: false,
    loading: () => (
      <span
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          color: "var(--text-dim)",
          padding: "6px 14px",
          border: "1px solid var(--line-2)",
        }}
      >
        CONNECT
      </span>
    ),
  },
);

const AlertBell = dynamic(() => import("@/components/notifications/AlertBell"), {
  ssr: false,
});

const LABELS: Record<string, string> = {
  "/": "SOVEREIGN / OVERVIEW",
  "/discover": "SOVEREIGN / DISCOVER",
  "/portfolio": "SOVEREIGN / PORTFOLIO",
  "/security": "SOVEREIGN / SECURITY",
  "/tools": "SOVEREIGN / TOOLS",
};

function labelFor(pathname: string): string {
  if (LABELS[pathname]) return LABELS[pathname];
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  return `SOVEREIGN / ${seg.toUpperCase() || "OVERVIEW"}`;
}

export function Topbar({ extra }: { extra?: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = time
    ? time.toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" })
    : "--:--:--";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 32px",
        borderBottom: "1px solid var(--line)",
        background: "color-mix(in oklch, var(--surface) 70%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 30,
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-dim)",
        gap: 16,
      }}
      className="mono"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 0 }}>
        <span style={{ color: "var(--text)", whiteSpace: "nowrap" }}>
          {labelFor(pathname)}
        </span>
        <span style={{ color: "var(--line-2)" }}>/</span>
        <span className="tabular" style={{ whiteSpace: "nowrap" }}>
          {clock} UTC
        </span>
        {extra}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              background: "var(--good)",
              borderRadius: "50%",
              boxShadow: "0 0 8px var(--good)",
              animation: "blink 2s infinite",
            }}
          />
          LIVE · DEFILLAMA
        </span>
        <span style={{ color: "var(--line-2)" }}>·</span>
        <span>CLAUDE OPUS 4.7</span>
        <span style={{ color: "var(--line-2)" }}>·</span>
        <AlertBell />
        <ConnectButton />
      </div>
    </div>
  );
}

export default Topbar;
