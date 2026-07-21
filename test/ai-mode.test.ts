import { afterEach, describe, expect, it } from "vitest";
import { getAiMode } from "@/lib/security/ai-mode";

const original = {
  NODE_ENV: process.env.NODE_ENV,
  AI_MODE: process.env.AI_MODE,
  OPENAI_MODE: process.env.OPENAI_MODE,
  FORCE_AI_API_MODE: process.env.FORCE_AI_API_MODE,
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("AI execution mode boundary", () => {
  it("rejects local agent CLIs in production", () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.AI_MODE = "cli";
    delete process.env.OPENAI_MODE;
    expect(() => getAiMode("codex")).toThrow(/production runtime/);
  });

  it("accepts the tool-free API path in production", () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.AI_MODE = "api";
    delete process.env.OPENAI_MODE;
    expect(getAiMode("codex")).toBe("api");
  });
});
