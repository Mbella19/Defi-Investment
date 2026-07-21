import { describe, expect, it } from "vitest";
import { escapeSlackMrkdwn } from "@/lib/notifications/channels/slack";
import { alertDiscordEmbed } from "@/lib/notifications/templates";
import type { StrategyMonitorAlert } from "@/lib/strategy-monitor";

function alert(overrides: Partial<StrategyMonitorAlert> = {}): StrategyMonitorAlert {
  return {
    id: "alert-1",
    strategyId: "strategy-123456",
    type: "exploit_alert",
    severity: "critical",
    poolId: "pool-1",
    protocol: "Protocol",
    symbol: "USDC",
    chain: "Ethereum",
    message: "Drain detected",
    detail: "Investigate immediately",
    createdAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("notification rendering boundaries", () => {
  it("neutralizes Slack mention and link control syntax", () => {
    expect(escapeSlackMrkdwn("<!channel> <https://evil.example|click> & text")).toBe(
      "&lt;!channel&gt; &lt;https://evil.example|click&gt; &amp; text",
    );
  });

  it("caps every Discord field to the platform limit", () => {
    const embed = alertDiscordEmbed(
      alert({ protocol: "p".repeat(2_000), symbol: "s".repeat(2_000), chain: "c".repeat(2_000) }),
    );
    expect(embed.fields.every((field) => field.value.length <= 1_024)).toBe(true);
  });
});
