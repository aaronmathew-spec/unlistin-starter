// src/lib/rate-limit.ts
/* Simple per-IP fixed-window rate limiter.
   - In-memory (per serverless instance); good enough for quick protection.
   - Can be swapped for Redis later with the same API shape.
*/

type LimitOptions = {
  windowMs: number;   // e.g. 60_000
  max: number;        // e.g. 30 requests / window
  prefix?: string;    // optional metric key prefix
};

type Bucket = {
  count: number;
  resetAt: number; // epoch ms when the window resets
};

const buckets = new Map<string, Bucket>();

/** Best-effort client IP from request headers (Vercel / proxies). */
export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    // first IP in the comma-separated list
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Next.js / Edge may expose a hint via CF-Connecting-IP etc.
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Fallback (not ideal, but deterministic)
  return "0.0.0.0";
}

/** Core limiter — returns { allowed, remaining, resetMs } */
export function rateLimit(key: string, opts: LimitOptions) {
  const now = Date.now();
  const bucketKey = `${opts.prefix || "rl"}:${key}:${Math.floor(now / opts.windowMs)}`;
  let b = buckets.get(bucketKey);

  if (!b) {
    b = { count: 0, resetAt: (Math.floor(now / opts.windowMs) + 1) * opts.windowMs };
    buckets.set(bucketKey, b);
  }
  b.count += 1;

  // opportunistic cleanup to avoid unbounded map
  // (cheap, only when we cross reset time)
  if (b.resetAt < now) buckets.delete(bucketKey);

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
