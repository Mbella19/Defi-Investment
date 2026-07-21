import "server-only";
import { promisify } from "util";
import { gzip, gunzip } from "zlib";
import { getDb } from "@/lib/db";
import { boundCache } from "@/lib/cache-utils";
import { log } from "@/lib/log";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const MAX_COMPRESSED_BYTES = 32 * 1024 * 1024;
const MEMORY_CACHE_MAX = 8;

interface CacheRow {
  schema_version: number;
  content_encoding: string;
  payload: Buffer;
  fresh_until: number;
  stale_until: number;
}

interface MemoryEntry {
  value: unknown;
  freshUntil: number;
  staleUntil: number;
  expiresAt: number;
}

interface CachedJsonOptions<T> {
  key: string;
  source: string;
  schemaVersion?: number;
  freshMs: number;
  staleMs: number;
  fetcher: () => Promise<T>;
  validate: (value: unknown) => value is T;
}

const memory = new Map<string, MemoryEntry>();
const inflight = new Map<string, Promise<unknown>>();

async function decodeRow<T>(row: CacheRow, validate: (value: unknown) => value is T): Promise<T | null> {
  if (row.content_encoding !== "gzip" || row.payload.byteLength > MAX_COMPRESSED_BYTES) {
    return null;
  }
  try {
    const decoded = await gunzipAsync(row.payload);
    const parsed: unknown = JSON.parse(decoded.toString("utf8"));
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Process-local hot cache backed by compressed SQLite storage. Large public
 * upstream payloads therefore survive restarts without entering Next's data
 * cache (whose per-entry limits are much smaller than DeFiLlama's pool feed).
 */
export async function cachedUpstreamJson<T>(options: CachedJsonOptions<T>): Promise<T> {
  const schemaVersion = options.schemaVersion ?? 1;
  const now = Date.now();
  const memoryHit = memory.get(options.key);
  if (memoryHit && memoryHit.freshUntil > now) return memoryHit.value as T;

  let stale: T | null = null;
  try {
    const row = getDb()
      .prepare(
        `SELECT schema_version, content_encoding, payload, fresh_until, stale_until
         FROM upstream_cache WHERE cache_key = ?`,
      )
      .get(options.key) as CacheRow | undefined;
    if (row && row.schema_version === schemaVersion && row.stale_until > now) {
      const decoded = await decodeRow(row, options.validate);
      if (decoded !== null) {
        stale = decoded;
        memory.set(options.key, {
          value: decoded,
          freshUntil: row.fresh_until,
          staleUntil: row.stale_until,
          expiresAt: row.stale_until,
        });
        boundCache(memory, MEMORY_CACHE_MAX);
        if (row.fresh_until > now) return decoded;
      } else {
        getDb().prepare("DELETE FROM upstream_cache WHERE cache_key = ?").run(options.key);
      }
    }
  } catch (error) {
    log.warn("upstream-cache", "persistent cache read failed", {
      source: options.source,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const active = inflight.get(options.key) as Promise<T> | undefined;
  if (active) return active;

  const request = (async (): Promise<T> => {
    try {
      const value = await options.fetcher();
      if (!options.validate(value)) throw new Error("Upstream response failed schema validation");
      const fetchedAt = Date.now();
      const freshUntil = fetchedAt + options.freshMs;
      const staleUntil = freshUntil + options.staleMs;
      try {
        const payload = await gzipAsync(Buffer.from(JSON.stringify(value), "utf8"));
        if (payload.byteLength > MAX_COMPRESSED_BYTES) {
          throw new Error("Compressed upstream payload exceeds storage limit");
        }
        getDb()
          .prepare(
            `INSERT INTO upstream_cache
               (cache_key, source, schema_version, content_encoding, payload,
                fetched_at, fresh_until, stale_until)
             VALUES (?, ?, ?, 'gzip', ?, ?, ?, ?)
             ON CONFLICT(cache_key) DO UPDATE SET
               source = excluded.source,
               schema_version = excluded.schema_version,
               content_encoding = excluded.content_encoding,
               payload = excluded.payload,
               fetched_at = excluded.fetched_at,
               fresh_until = excluded.fresh_until,
               stale_until = excluded.stale_until`,
          )
          .run(
            options.key,
            options.source,
            schemaVersion,
            payload,
            fetchedAt,
            freshUntil,
            staleUntil,
          );
        getDb().prepare("DELETE FROM upstream_cache WHERE stale_until <= ?").run(fetchedAt);
      } catch (error) {
        // A cache write is an optimization, never a reason to discard a valid
        // fresh upstream response.
        log.warn("upstream-cache", "persistent cache write failed", {
          source: options.source,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      memory.set(options.key, {
        value,
        freshUntil,
        staleUntil,
        expiresAt: staleUntil,
      });
      boundCache(memory, MEMORY_CACHE_MAX);
      return value;
    } catch (error) {
      if (stale !== null) {
        log.warn("upstream-cache", "serving stale upstream data", {
          source: options.source,
          error: error instanceof Error ? error.message : String(error),
        });
        return stale;
      }
      throw error;
    } finally {
      inflight.delete(options.key);
    }
  })();
  inflight.set(options.key, request);
  return request;
}
