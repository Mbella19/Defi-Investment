import { describe, expect, it } from "vitest";
import { readJsonBody } from "@/lib/request-body";

describe("bounded JSON request parsing", () => {
  it("parses a valid object", async () => {
    const request = new Request("https://app.example/api", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
      headers: { "Content-Type": "application/json" },
    });
    await expect(readJsonBody(request)).resolves.toEqual({ ok: true });
  });

  it("rejects both declared and chunked oversized bodies", async () => {
    const declared = new Request("https://app.example/api", {
      method: "POST",
      body: "x".repeat(20),
      headers: { "Content-Length": "20" },
    });
    await expect(readJsonBody(declared, 10)).rejects.toMatchObject({ status: 413 });

    const chunked = new Request("https://app.example/api", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("{\"value\":\"0123456789\"}"));
          controller.close();
        },
      }),
      // Required by Node's Request implementation for streaming request bodies.
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(readJsonBody(chunked, 10)).rejects.toMatchObject({ status: 413 });
  });
});
