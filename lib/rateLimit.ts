type Decision = { ok: true } | { ok: false; retryAfter: number };

const GLOBAL = globalThis as unknown as {
  __rate_buckets?: Map<string, { tokens: number; ts: number }>;
};
if (!GLOBAL.__rate_buckets) GLOBAL.__rate_buckets = new Map();

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

// Simple token bucket fallback (per instance)
function localCheck(key: string, rate = 10, intervalMs = 10_000): Decision {
  const now = Date.now();
  const bucket = GLOBAL.__rate_buckets!.get(key) ?? { tokens: rate, ts: now };
  const refill = Math.floor((now - bucket.ts) / intervalMs) * rate;
  const tokens = Math.min(rate, bucket.tokens + Math.max(0, refill));
  const newState = { tokens, ts: refill ? now : bucket.ts };

  if (newState.tokens > 0) {
    newState.tokens -= 1;
    GLOBAL.__rate_buckets!.set(key, newState);
    return { ok: true };
  } else {
    GLOBAL.__rate_buckets!.set(key, newState);
    return { ok: false, retryAfter: intervalMs / 1000 };
  }
}

export async function ensureRateLimit(key: string, rate = 10, intervalSec = 10): Promise<Decision> {
  if (!hasUpstash) return localCheck(key, rate, intervalSec * 1000);

  // Upstash (soft dependency)
  try {
    const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ratelimit/take/${encodeURIComponent(key)}?max=${rate}&window=${intervalSec}`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      cache: "no-store",
    });
    const json = await res.json();
    if (json.allowed) return { ok: true };
    return { ok: false, retryAfter: Math.max(1, Math.ceil((json.reset ?? intervalSec))) };
  } catch {
    return localCheck(key, rate, intervalSec * 1000);
  }
}
