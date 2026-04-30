import "server-only";
import type { StrategyMonitorAlert } from "@/lib/strategy-monitor";

const TYPE_LABEL: Record<string, string> = {
  apy_drop: "APY drop",
  tvl_drain: "TVL drain",
  rebalance: "Rebalance signal",
  protocol_tvl_crash: "Protocol TVL crash",
  protocol_paused: "Protocol paused",
  exploit_alert: "Exploit alert",
};

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "🔵",
};

const SEVERITY_DISCORD_COLOR: Record<string, number> = {
  critical: 0xef4444,
  warning: 0xf59e0b,
  info: 0x3b82f6,
};

export function alertTitle(alert: StrategyMonitorAlert): string {
  const label = TYPE_LABEL[alert.type] ?? alert.type;
  const sev = alert.severity.toUpperCase();
  return `[${sev}] ${label}: ${alert.message}`.slice(0, 200);
}

export function alertPlainText(alert: StrategyMonitorAlert): string {
  const emoji = SEVERITY_EMOJI[alert.severity.toLowerCase()] ?? "•";
  const label = TYPE_LABEL[alert.type] ?? alert.type;
  const lines = [
    `${emoji} ${alert.severity.toUpperCase()} — ${label}`,
    "",
    alert.message,
    "",
    `Protocol: ${alert.protocol || "—"}`,
    `Pool: ${alert.symbol || "—"}`,
    `Chain: ${alert.chain || "—"}`,
  ];
  if (alert.detail) {
    lines.push("", alert.detail);
  }
  return lines.join("\n");
}

export function alertHtml(alert: StrategyMonitorAlert): string {
  const sev = alert.severity.toLowerCase();
  const color =
    sev === "critical" ? "#ef4444" : sev === "warning" ? "#f59e0b" : "#3b82f6";
  const label = TYPE_LABEL[alert.type] ?? alert.type;
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `<!doctype html>
<html><body style="margin:0;background:#0d1015;color:#e9edf2;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="border-left:4px solid ${color};padding:18px 22px;background:#1a1d24;border-radius:10px;">
      <div style="text-transform:uppercase;font-size:11px;letter-spacing:0.08em;color:${color};font-weight:700;margin-bottom:6px;">
        ${escape(alert.severity)} · ${escape(label)}
      </div>
      <div style="font-size:18px;font-weight:600;line-height:1.3;color:#fff;margin-bottom:14px;">
        ${escape(alert.message)}
      </div>
      <table style="width:100%;font-size:13px;color:#9aa3b0;border-collapse:collapse;">
        <tr><td style="padding:4px 0;width:80px;">Protocol</td><td style="color:#e9edf2;">${escape(alert.protocol || "—")}</td></tr>
        <tr><td style="padding:4px 0;">Pool</td><td style="color:#e9edf2;">${escape(alert.symbol || "—")}</td></tr>
        <tr><td style="padding:4px 0;">Chain</td><td style="color:#e9edf2;">${escape(alert.chain || "—")}</td></tr>
      </table>
      ${alert.detail ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid #2a313d;font-size:13px;line-height:1.55;color:#c8d1dc;">${escape(alert.detail)}</div>` : ""}
    </div>
    <div style="margin-top:20px;text-align:center;font-size:12px;color:#6c7280;">
      Sovereign · 24/7 monitoring on every position you deploy.
    </div>
  </div>
</body></html>`;
}

export function alertDiscordEmbed(alert: StrategyMonitorAlert) {
  const sev = alert.severity.toLowerCase();
  const color = SEVERITY_DISCORD_COLOR[sev] ?? SEVERITY_DISCORD_COLOR.info;
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: "Protocol", value: alert.protocol || "—", inline: true },
    { name: "Pool", value: alert.symbol || "—", inline: true },
    { name: "Chain", value: alert.chain || "—", inline: true },
  ];
  if (alert.detail) {
    fields.push({ name: "Detail", value: alert.detail.slice(0, 1000) });
  }
  return {
    title: alertTitle(alert).slice(0, 256),
    description: `Strategy \`${alert.strategyId.slice(0, 8)}\` flagged a new event.`,
    color,
    timestamp: alert.createdAt,
    fields,
    footer: { text: "Sovereign · continuous monitoring" },
  };
}
