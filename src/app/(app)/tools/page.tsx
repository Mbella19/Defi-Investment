"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { Icons, ThemeToggle } from "@/components/sovereign";

type Tool = {
  n: string;
  d: string;
  href: string;
  ic: ComponentType<{ size?: number; stroke?: number }>;
};

const TOOLS: Tool[] = [
  {
    n: "Scenario Analysis",
    d: "Estimate how an allocation behaves under changing income rates, liquidity, and market conditions before committing capital.",
    href: "/tools/simulator",
    ic: Icons.activity,
  },
  {
    n: "Correlation Review",
    d: "Compare up to twelve markets to see whether an allocation is genuinely diversified or simply repeating the same exposure.",
    href: "/tools/correlation",
    ic: Icons.pie,
  },
];

export default function ToolsPage() {
  return (
    <>
      {/* ---------- DESKTOP ---------- */}
      <div className="page-wrap">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div className="eyebrow">MODELS</div>
            <h1
              className="display"
              style={{ fontSize: 28, margin: "6px 0 2px", letterSpacing: "-0.02em" }}
            >
              Model before you allocate.
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
              Compare downside, concentration, and return assumptions in a read-only workspace.
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          {TOOLS.map((t) => {
            const Ic = t.ic;
            return (
              <Link
                key={t.n}
                href={t.href}
                className="card"
                style={{
                  padding: 22,
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                  minHeight: 150,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
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
                  <Ic size={20} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                    {t.n}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-dim)",
                      lineHeight: 1.5,
                    }}
                  >
                    {t.d}
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 12,
                      fontSize: 12.5,
                      color: "var(--accent)",
                      fontWeight: 500,
                    }}
                  >
                    Open model <Icons.arrow size={12} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ---------- MOBILE ---------- */}
      <div className="mobile-only">
        <div className="m-header">
          <div>
            <div className="m-title">Models</div>
            <div className="m-sub">READ-ONLY ANALYSIS</div>
          </div>
          <ThemeToggle variant="mobile" />
        </div>
        <div className="m-content">
          {TOOLS.map((t) => {
            const Ic = t.ic;
            return (
              <Link
                key={`m-${t.n}`}
                href={t.href}
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
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
