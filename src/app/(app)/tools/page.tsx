"use client";

import type { ComponentType } from "react";
import { Icons } from "@/components/sovereign";

type Tool = {
  n: string;
  d: string;
  ic: ComponentType<{ size?: number; stroke?: number }>;
};

const TOOLS: Tool[] = [
  {
    n: "Yield Simulator",
    d: "Model allocations against historical APY curves and stress scenarios.",
    ic: Icons.activity,
  },
  {
    n: "Tax & Cost-basis",
    d: "Aggregate on-chain yield events into FIFO / LIFO reports.",
    ic: Icons.coins,
  },
  {
    n: "Bridge Router",
    d: "Lowest-slippage routes across canonical bridges and CCTP.",
    ic: Icons.globe,
  },
  {
    n: "Gas Radar",
    d: "Per-chain gas bands and best-time-to-transact suggestions.",
    ic: Icons.zap,
  },
  {
    n: "Correlation Matrix",
    d: "Pool vs pool returns correlation over 90 days.",
    ic: Icons.pie,
  },
  {
    n: "Wallet Forensics",
    d: "Decode a wallet's positions, counterparties, and recent actions.",
    ic: Icons.search,
  },
];

export default function ToolsPage() {
  return (
    <>
      {/* ---------- DESKTOP ---------- */}
      <div className="page-wrap">
        <div>
          <div className="eyebrow">TOOLS</div>
          <h1
            className="display"
            style={{ fontSize: 28, margin: "6px 0 2px", letterSpacing: "-0.02em" }}
          >
            Utilities
          </h1>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Modeling, routing, and forensics — read-only, no wallet required
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {TOOLS.map((t) => {
            const Ic = t.ic;
            return (
              <div
                key={t.n}
                className="card"
                style={{
                  padding: 20,
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  minHeight: 130,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: "var(--surface-3)",
                    color: "var(--text-1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--line)",
                  }}
                >
                  <Ic size={18} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                    {t.n}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-dim)",
                      lineHeight: 1.45,
                    }}
                  >
                    {t.d}
                  </div>
                  <a
                    href="#"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 10,
                      fontSize: 12.5,
                      color: "var(--accent)",
                      fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    Open <Icons.arrow size={12} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- MOBILE ---------- */}
      <div className="mobile-only">
        <div className="m-header">
          <div>
            <div className="m-title">Tools</div>
            <div className="m-sub">MODELING · ROUTING · FORENSICS</div>
          </div>
        </div>
        <div className="m-content">
          {TOOLS.map((t) => {
            const Ic = t.ic;
            return (
              <a
                key={`m-${t.n}`}
                href="#"
                className="card"
                style={{
                  padding: 14,
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: "var(--surface-3)",
                    color: "var(--text-1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--line)",
                  }}
                >
                  <Ic size={17} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.n}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-dim)",
                      lineHeight: 1.4,
                      marginTop: 2,
                    }}
                  >
                    {t.d}
                  </div>
                </div>
                <Icons.chevR size={16} style={{ color: "var(--text-dim)", marginTop: 8 }} />
              </a>
            );
          })}
        </div>
      </div>
    </>
  );
}
