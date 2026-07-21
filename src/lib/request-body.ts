import "server-only";

const DEFAULT_MAX_JSON_BYTES = 64 * 1024;

export class JsonBodyError extends Error {
  constructor(
    readonly status: 400 | 413,
    message: string,
  ) {
    super(message);
    this.name = "JsonBodyError";
  }
}

/** Parse a UTF-8 JSON body with a hard byte ceiling, including chunked input. */
export async function readJsonBody(
  request: Request,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0) {
      throw new JsonBodyError(400, "Invalid Content-Length");
    }
    if (length > maxBytes) throw new JsonBodyError(413, "JSON body is too large");
  }
  if (!request.body) throw new JsonBodyError(400, "Invalid JSON body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new JsonBodyError(413, "JSON body is too large");
      }
      chunks.push(next.value);
    }
  } catch (error) {
    if (error instanceof JsonBodyError) throw error;
    throw new JsonBodyError(400, "Invalid JSON body");
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    throw new JsonBodyError(400, "Invalid JSON body");
  }
}

export function jsonBodyErrorResponse(error: unknown): Response {
  const status = error instanceof JsonBodyError ? error.status : 400;
  const message = status === 413 ? "JSON body is too large" : "Invalid JSON body";
  return Response.json({ error: message }, { status });
}
