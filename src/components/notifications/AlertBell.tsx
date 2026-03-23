"use client";

import { useState, useRef, useEffect } from "react";
import { useStrategyAlerts } from "@/hooks/useStrategyAlerts";

export default function AlertBell() {
  const { alerts, unreadCount, markAllRead } = useStrategyAlerts();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const severityIcon: Record<string, string> = {
    critical: "error",
    warning: "warning",
    info: "info",
  };

  const severityColor: Record<string, string> = {
    critical: "text-danger",
    warning: "text-yellow-600 dark:text-yellow-400",
    info: "text-accent",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold flex items-center justify-center rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 sm:w-96 bg-surface-low border border-outline shadow-xl z-50 max-h-[400px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline">
            <span className="text-[13px] font-semibold uppercase tracking-[0.15em] text-label/70">
              Alerts ({unreadCount})
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="text-xs text-accent font-semibold hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Alerts list */}
          <div className="overflow-y-auto flex-1">
            {alerts.length === 0 ? (
              <div className="p-6 text-center">
                <span className="material-symbols-outlined text-2xl text-muted mb-2 block">check_circle</span>
                <p className="text-sm text-muted">No alerts</p>
              </div>
            ) : (
              alerts.slice(0, 10).map((alert) => (
                <div
                  key={alert.id}
                  className={`px-4 py-3 border-b border-outline/50 hover:bg-surface-highest/50 transition-colors ${
                    !alert.read ? "bg-accent/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`material-symbols-outlined text-sm mt-0.5 ${severityColor[alert.severity]}`}>
                      {severityIcon[alert.severity]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface">{alert.message}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {alert.protocol} · {alert.symbol} · {alert.chain}
                      </p>
                      <p className="text-xs text-muted mt-1">{alert.detail}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <a
              href="/strategies"
              className="block text-center text-xs font-semibold text-accent py-3 border-t border-outline hover:bg-surface-highest/50 transition-colors"
            >
              View all strategies →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
