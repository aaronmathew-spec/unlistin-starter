/* lib/ratelimit.ts */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type LimitResult = { ok: boolean; remaining: number; reset: number };

/** Basic in-memory limiter for local/dev or when Redis isn’t configured */
class MemoryLimiter {
  private map = new Map<
    string,
    { count: number; resetAt: number; windowMs: number; limit: number }
  >();

  constructor(private windowMs: number, private limit: number) {}

  check(key: string): LimitResult {
    const now = Date.now();
    const slot = this.map.get(key);

    if (!slot || now >= slot.resetAt) {
      const resetAt = now + this.windowMs;
      this.map.set(key, {
        count: 1,
        resetAt,
        windowMs: this.windowMs,
        limit: this.limit,
      });
      return { ok: true, remaining: this.limit - 1, reset: Math.floor(resetAt / 1000) };
    }

    if (slot.count >= this.limit) {
      return { ok: false, remaining: 0, reset: Math.floor(slot.resetAt / 1000) };
    }

    slot.count += 1;
    return {
      ok: true,
      remaining: Math.max(0, slot.limit - slot.count),
      reset: Math.floor(slot.resetAt / 1000),
    };
  }
}

const AI_WINDOW_MS = 60_000; // 1 min
const AI_LIMIT = 30;         // 30 req/min (per IP or user)
const SEARCH_WINDOW_MS = 60_000;
const SEARCH_LIMIT = 60;     // 60 req/min

function getClientIp(req: Request): string {
  const h = (name: string) => req.headers.get(name) || "";
  return (
    h("x-forwarded-for").split(",")[0]?.trim() ||
    h("x-real-ip") ||
    h("cf-connecting-ip") ||
    "ip:unknown"
  );
}

/** Lazily create an Upstash limiter when env vars exist */
async function getUpstashLimiter(limit: number, windowSec: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis"),
  ]);

  const redis = new Redis({ url, token });
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s` as any),
    analytics: false,
    prefix: "rl",
  });
}

/** Internal cache for local fallback limiters */
function getMem(name: "__aiLimiter" | "__searchLimiter", windowMs: number, limit: number) {
  const g = globalThis as any;
  if (!g[name]) g[name] = new MemoryLimiter(windowMs, limit);
  return g[name] as MemoryLimiter;
}

/** Unified helper: rate-limit AI calls (chat, index, etc.) */
export async function ensureAiLimit(req: Request): Promise<LimitResult> {
  const key = `ai:${getClientIp(req)}`;
  const upstash = await getUpstashLimiter(AI_LIMIT, Math.round(AI_WINDOW_MS / 1000));

  if (upstash) {
    const r = await upstash.limit(key);
    return {
      ok: !!r.success,
      remaining: typeof r.remaining === "number" ? r.remaining : 0,
      reset: typeof r.reset === "number" ? r.reset : Math.floor(Date.now() / 1000) + 60,
    };
  }

  // Fallback
  const mem = getMem("__aiLimiter", AI_WINDOW_MS, AI_LIMIT);
  return mem.check(key);
}

/** For semantic/keyword search endpoints */
export async function ensureSearchLimit(req: Request): Promise<LimitResult> {
  const key = `search:${getClientIp(req)}`;
  const upstash = await getUpstashLimiter(SEARCH_LIMIT, Math.round(SEARCH_WINDOW_MS / 1000));

  if (upstash) {
    const r = await upstash.limit(key);
    return {
      ok: !!r.success,
      remaining: typeof r.remaining === "number" ? r.remaining : 0,
      reset: typeof r.reset === "number" ? r.reset : Math.floor(Date.now() / 1000) + 60,
    };
  }

  const mem = getMem("__searchLimiter", SEARCH_WINDOW_MS, SEARCH_LIMIT);
  return mem.check(key);
}

/** Generic helper (if you need it elsewhere) */
export async function ensureRateLimit(
  req: Request,
  name: string,
  limit: number,
  windowMs: number
): Promise<LimitResult> {
  const key = `${name}:${getClientIp(req)}`;
  const upstash = await getUpstashLimiter(limit, Math.round(windowMs / 1000));

  if (upstash) {
    const r = await upstash.limit(key);
    return {
      ok: !!r.success,
      remaining: typeof r.remaining === "number" ? r.remaining : 0,
      reset: typeof r.reset === "number" ? r.reset : Math.floor(Date.now() / 1000) + 60,
    };
  }

  const g = globalThis as any;
  const cacheKey = `__mem_${name}`;
  if (!g[cacheKey]) g[cacheKey] = new MemoryLimiter(windowMs, limit);
  return (g[cacheKey] as MemoryLimiter).check(key);
}
