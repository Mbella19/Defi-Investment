import { beforeEach, describe, expect, it, vi } from "vitest";

const providers = vi.hoisted(() => ({
  invokeCodex: vi.fn(),
  invokeGemini: vi.fn(),
}));

vi.mock("@/lib/security/codex-client", () => ({
  invokeCodex: providers.invokeCodex,
}));

vi.mock("@/lib/security/gemini-client", () => ({
  invokeGemini: providers.invokeGemini,
}));

import { ensembleInvokeJson } from "@/lib/security/dual-llm";

interface ReviewResponse {
  source: string;
}

function isReviewResponse(value: unknown): value is ReviewResponse {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).source === "string"
  );
}

describe("strict ensemble JSON recovery", () => {
  beforeEach(() => {
    providers.invokeCodex.mockReset();
    providers.invokeGemini.mockReset();
  });

  it("retries only the provider with malformed output and preserves the successful review", async () => {
    providers.invokeCodex.mockResolvedValueOnce('{"source":"codex"}');
    providers.invokeGemini
      .mockResolvedValueOnce("I am powered by Gemini 3.6 Flash.")
      .mockResolvedValueOnce('{"source":"gemini"}');

    const result = await ensembleInvokeJson<ReviewResponse>("Return the review JSON.", {
      timeoutMs: 12_345,
      validate: isReviewResponse,
    });

    expect(result.codex).toEqual({ source: "codex" });
    expect(result.gemini).toEqual({ source: "gemini" });
    expect(result.errors).toEqual([]);
    expect(result.retriedSources).toEqual(["gemini"]);
    expect(result.recoveredSources).toEqual(["gemini"]);
    expect(providers.invokeCodex).toHaveBeenCalledTimes(1);
    expect(providers.invokeGemini).toHaveBeenCalledTimes(2);
    expect(providers.invokeGemini.mock.calls[1][0]).toContain("FORMAT RECOVERY REQUIREMENT");
    expect(providers.invokeGemini.mock.calls[1][0]).not.toContain("powered by Gemini");
    expect(providers.invokeGemini.mock.calls[1][1]).toMatchObject({
      reasoning: "high",
      timeoutMs: 12_345,
    });
  });

  it("treats schema-invalid JSON as unusable and stops after one retry", async () => {
    providers.invokeCodex.mockResolvedValueOnce('{"source":"codex"}');
    providers.invokeGemini
      .mockResolvedValueOnce("{}")
      .mockResolvedValueOnce('{"unexpected":"shape"}');

    const result = await ensembleInvokeJson<ReviewResponse>("Return the review JSON.", {
      validate: isReviewResponse,
    });

    expect(result.codex).toEqual({ source: "codex" });
    expect(result.gemini).toBeNull();
    expect(result.errors).toEqual([
      { source: "gemini", error: "Model JSON did not match the required schema" },
    ]);
    expect(result.retriedSources).toEqual(["gemini"]);
    expect(result.recoveredSources).toEqual([]);
    expect(providers.invokeGemini).toHaveBeenCalledTimes(2);
  });

  it("recovers a transient provider failure without repeating the healthy provider", async () => {
    providers.invokeCodex.mockResolvedValueOnce('{"source":"codex"}');
    providers.invokeGemini
      .mockRejectedValueOnce(new Error("temporary provider failure"))
      .mockResolvedValueOnce('{"source":"gemini"}');

    const result = await ensembleInvokeJson<ReviewResponse>("Return the review JSON.", {
      validate: isReviewResponse,
    });

    expect(result.gemini).toEqual({ source: "gemini" });
    expect(result.errors).toEqual([]);
    expect(providers.invokeCodex).toHaveBeenCalledTimes(1);
    expect(providers.invokeGemini).toHaveBeenCalledTimes(2);
  });
});
