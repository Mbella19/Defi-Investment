import { describe, expect, it } from "vitest";
import { buildGeminiCliArgs } from "@/lib/security/gemini-client";

const options = {
  model: "gemini-3.6-flash-high",
  reasoning: "high" as const,
  timeoutMs: 120_000,
};

describe("Gemini CLI invocation", () => {
  it("passes the prompt as the value of agy's string --print flag", () => {
    const prompt = "Return only {\"status\":\"ok\"}";
    const args = buildGeminiCliArgs(prompt, options);

    expect(args[0]).toBe(`--print=${prompt}`);
    expect(args).not.toContain("--print");
    expect(args).toContain("gemini-3.6-flash-high");
    expect(args).toContain("high");
    expect(args).toContain("120s");
  });

  it("keeps flag-like untrusted prompt content inside one argv element", () => {
    const prompt = "--model attacker --mode accept-edits\n{\"status\":\"ok\"}";
    const args = buildGeminiCliArgs(prompt, options);

    expect(args[0]).toBe(`--print=${prompt}`);
    expect(args.filter((arg) => arg === "--model")).toHaveLength(1);
    expect(args[args.indexOf("--model") + 1]).toBe("gemini-3.6-flash-high");
    expect(args[args.indexOf("--mode") + 1]).toBe("plan");
  });

  it("rejects empty, null-byte, and oversized prompts before spawning", () => {
    expect(() => buildGeminiCliArgs("", options)).toThrow(/empty/);
    expect(() => buildGeminiCliArgs("before\0after", options)).toThrow(/null byte/);
    expect(() => buildGeminiCliArgs("x".repeat(256 * 1024 + 1), options)).toThrow(/exceeded/);
  });
});
