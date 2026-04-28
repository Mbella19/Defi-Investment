"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useStrategyAlerts } from "@/hooks/useStrategyAlerts";
import { Icons } from "@/components/sovereign";

const severityColor: Record<string, string> = {
  critical: "var(--danger)",
  warning: "var(--warn)",
  info: "var(--accent)",
};

export default function AlertBell() {
  const { alerts, unreadCount, markAllRead } = useStrategyAlerts();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        style={{
          width: 36,
          height: 36,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-dim)",
          background: "transparent",
          border: "1px solid var(--line)",
          cursor: "pointer",
          position: "relative",
          transition: "color 0.2s, border-color 0.2s",
        }}
      >
        <Icons.bell />
        {unreadCount > 0 ? (
          <span
            className="mono tabular"
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              background: "var(--danger)",
              color: "var(--bg)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 10px color-mix(in oklch, var(--danger) 60%, transparent)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="brackets"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 10px)",
            width: 360,
            maxHeight: 420,
            background: "var(--surface)",
            border: "1px solid var(--line-2)",
            boxShadow: "var(--shadow)",
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
              }}
            >
              ALERTS · {unreadCount}
            </span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                MARK ALL READ
              </button>
            ) : null}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {alerts.length === 0 ? (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  color: "var(--text-muted)",
                }}
              >
                <div
                  className="mono"
                  style={{ fontSize: 10, letterSpacing: "0.22em" }}
                >
                  NO ALERTS · ALL CLEAR
                </div>
              </div>
            ) : (
              alerts.slice(0, 10).map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--line)",
                    background: !alert.read ? "var(--accent-soft)" : "transparent",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      marginTop: 6,
                      flexShrink: 0,
                      background: severityColor[alert.severity] ?? "var(--accent)",
                      boxShadow: `0 0 8px ${severityColor[alert.severity] ?? "var(--accent)"}`,
                      borderRadius: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text)",
                        lineHeight: 1.35,
                      }}
                    >
                      {alert.message}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        color: "var(--text-dim)",
                        marginTop: 4,
                      }}
                    >
                      {alert.protocol} · {alert.symbol} · {alert.chain}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        marginTop: 4,
                      }}
                    >
                      {alert.detail}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      {alert.poolId ? (
                        <a
                          href={`https://defillama.com/yields/pool/${alert.poolId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mono"
                          style={{
                            fontSize: 9.5,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: "var(--accent)",
                            background: "var(--accent-soft)",
                            border: "1px solid color-mix(in oklch, var(--accent) 32%, transparent)",
                            padding: "4px 8px",
                            borderRadius: 5,
                            textDecoration: "none",
                          }}
                        >
                          View market →
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {alerts.length > 0 ? (
            <Link
              href="/strategies"
              className="mono"
              style={{
                textAlign: "center",
                fontSize: 10,
                letterSpacing: "0.22em",
                color: "var(--accent)",
                padding: "12px",
                borderTop: "1px solid var(--line)",
                textDecoration: "none",
                textTransform: "uppercase",
              }}
            >
              VIEW ALL ALLOCATIONS →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
