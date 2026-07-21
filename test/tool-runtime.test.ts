import { describe, expect, it } from "vitest";
import { runProcess } from "@/lib/security/tools/runtime";

describe("security tool process runner", () => {
  it("enforces one combined output budget", async () => {
    await expect(
      runProcess(
        process.execPath,
        ["-e", "process.stdout.write('x'.repeat(128)); process.stderr.write('y'.repeat(128));"],
        { maxBufferBytes: 200, timeoutMs: 2_000 },
      ),
    ).rejects.toThrow(/output limit/);
  });

  it("terminates work that exceeds its deadline", async () => {
    await expect(
      runProcess(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
        timeoutMs: 100,
      }),
    ).rejects.toThrow(/timed out/);
  });
});
