// src/lib/rate-limit.ts
/* Universal rate limiter:
   - Default: fast in-memory (per serverless instance).
   - Optional: Upstash Redis (global) if UPSTASH_REDIS_REST_URL/TOKEN are set.
   - Backward compatible exports: getClientIp, rateLimit (sync), tooManyResponse (429 helper).
   - New: rateLimitAsync(...) that prefers Redis and falls back to memory.
*/

type LimitOptions = {
  windowMs: number;     // e.g. 60_000
  max: number;          // e.g. 30 requests / window
  prefix?: string;      // optional metric key prefix
};

type Bucket = {
  count: number;
  resetAt: number;      // epoch ms when the window resets
};

const memoryBuckets = new Map<string, Bucket>();

/** Best-effort client IP from request headers (Vercel / proxies). */
export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  return "0.0.0.0";
}

/** In-memory fixed-window limiter (sync) — what your routes already use. */
export function rateLimit(key: string, opts: LimitOptions) {
  const now = Date.now();
  const win = Math.floor(now / opts.windowMs);
  const bucketKey = `${opts.prefix || "rl"}:${key}:${win}`;

  let b = memoryBuckets.get(bucketKey);
  if (!b) {
    b = { count: 0, resetAt: (win + 1) * opts.windowMs };
    memoryBuckets.set(bucketKey, b);
  }

  b.count += 1;

  // opportunistic cleanup
  if (b.resetAt < now) memoryBuckets.delete(bucketKey);

  const allowed = b.count <= opts.max;
  const remaining = Math.max(0, opts.max - b.count);
  const resetMs = Math.max(0, b.resetAt - now);

  return { allowed, remaining, resetMs };
}

/** Helper to emit standard 429 JSON with headers */
export function tooManyResponse(remaining: number, resetMs: number) {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "rate_limited",
      retry_after_ms: resetMs,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-ratelimit-remaining": String(remaining),
        "x-ratelimit-reset": String(resetMs),
      },
    }
  );
}

/* ---------------------------------------------
   Optional Redis (Upstash) backend
---------------------------------------------- */

let redisReady: boolean | null = null;

async function getRedis(): Promise<null | { incr: (k: string) => Promise<number>; pexpire: (k: string, ms: number) => Promise<number>; pttl: (k: string) => Promise<number>; }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    redisReady = false;
    return null;
  }

  try {
    // dynamic import to avoid hard dependency if you don't install @upstash/redis
    const mod: typeof import("@upstash/redis") = await import("@upstash/redis");
    const client = new mod.Redis({ url, token });

    // Wrap minimal calls we need
    return {
      incr: (k: string) => client.incr(k),
      pexpire: (k: string, ms: number) => client.pexpire(k, ms),
      pttl: (k: string) => client.pttl(k),
    };
  } catch {
    redisReady = false;
    return null;
  }
}

/**
 * Async limiter that prefers Redis when configured, falling back to memory.
 * Use this if you want **global** limits across all serverless instances.
 *
 * Example (swap in your route):
 *   const rl = await rateLimitAsync(`media-hash:${ip}`, { windowMs: 60_000, max: 30, prefix: "api" });
 */
export async function rateLimitAsync(key: string, opts: LimitOptions) {
  const now = Date.now();
  const win = Math.floor(now / opts.windowMs);
  const redisKey = `${opts.prefix || "rl"}:${key}:${win}`;

  // If we've already discovered redis isn't available, skip trying again.
  if (redisReady === false) return rateLimit(key, opts);

  const redis = await getRedis();
  if (!redis) {
    // no Redis → use memory
    return rateLimit(key, opts);
  }

  try {
    // Atomic-ish: INCR; if first hit, set PEXPIRE; then read TTL.
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, opts.windowMs);
    }
    let ttl = await redis.pttl(redisKey);
    // PTTL returns -2 (key missing) or -1 (no expire) for edge cases
    if (ttl < 0) {
      await redis.pexpire(redisKey, opts.windowMs);
      ttl = opts.windowMs;
    }

    const allowed = count <= opts.max;
    const remaining = Math.max(0, opts.max - count);
    const resetMs = Math.max(0, ttl);

    redisReady = true;
    return { allowed, remaining, resetMs };
  } catch {
    // If Redis errors, degrade gracefully to memory
    redisReady = false;
    return rateLimit(key, opts);
  }
}
