import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/security/claude-client";

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it("strips markdown fences", () => {
    expect(extractJson('```json\n{"a": 2}\n```')).toEqual({ a: 2 });
    expect(extractJson('```\n{"a": 3}\n```')).toEqual({ a: 3 });
  });

  it("ignores surrounding prose", () => {
    expect(extractJson('Here is my analysis:\n{"score": 42}\nHope that helps!')).toEqual({
      score: 42,
    });
  });

  it("keeps braces inside strings from closing the object early", () => {
    expect(extractJson('{"note": "has a } brace and a { brace", "n": 5}')).toEqual({
      note: "has a } brace and a { brace",
      n: 5,
    });
  });

  it("handles escaped quotes inside strings", () => {
    expect(extractJson('{"quote": "she said \\"hi}\\"", "ok": true}')).toEqual({
      quote: 'she said "hi}"',
      ok: true,
    });
  });

  it("handles nested objects", () => {
    expect(extractJson('{"outer": {"inner": {"deep": 1}}}')).toEqual({
      outer: { inner: { deep: 1 } },
    });
  });

  it("throws when no object is present", () => {
    expect(() => extractJson("no json here")).toThrow();
  });

  it("throws on unbalanced braces", () => {
    expect(() => extractJson('{"a": 1')).toThrow();
  });
});
