import { describe, expect, it } from "vitest";
import { fetchWithTimeout } from "@/lib/fetch-utils";

describe("fetchWithTimeout", () => {
  it("keeps the response body readable within its byte budget", async () => {
    const response = await fetchWithTimeout("data:text/plain,hello", {}, 1_000, 10);
    expect(await response.text()).toBe("hello");
  });

  it("rejects a body that exceeds the configured byte budget", async () => {
    const response = await fetchWithTimeout(
      `data:text/plain,${"x".repeat(128)}`,
      {},
      1_000,
      32,
    );
    await expect(response.text()).rejects.toThrow(/exceeded 32 bytes/);
  });
});
