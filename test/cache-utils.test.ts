import { describe, expect, it } from "vitest";
import { boundCache } from "@/lib/cache-utils";

describe("boundCache", () => {
  it("removes expired entries and caps the post-insert size", () => {
    const now = Date.now();
    const cache = new Map<string, { expiresAt: number }>([
      ["expired", { expiresAt: now - 1 }],
      ["oldest", { expiresAt: now + 10_000 }],
      ["middle", { expiresAt: now + 10_000 }],
      ["newest", { expiresAt: now + 10_000 }],
    ]);
    boundCache(cache, 2);
    expect([...cache.keys()]).toEqual(["middle", "newest"]);
  });
});
