// lib/ratelimit.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

// Basic, process-local fallback limiter (for dev / no-Redis envs)
class MemoryLimiter {
  private map = new Map<string, { count: number; resetAt: number }>();
  constructor(private windowMs: number, private limit: number) {}

  check(key: string) {
    const now = Date.now();
    const slot = this.map.get(key);
    if (!slot || now > slot.resetAt) {
      this.map.set(key, { count: 1, resetAt: now + this.windowMs });
      return { ok: true, remaining: this.limit - 1 };
    }
    if (slot.count >= this.limit) {
      return { ok: false, remaining: 0 };
    }
    slot.count += 1;
    return { ok: true, remaining: this.limit - slot.count };
  }
}

const AI_WINDOW_MS = 60_000; // 1 min
const AI_LIMIT = 30;         // 30 req/min (per IP or user)
const SEARCH_WINDOW_MS = 60_000;
const SEARCH_LIMIT = 60;     // 60 req/min

function getClientIp(req: Request): string {
  // Works on Vercel/Next API
  const h = (name: string) => req.headers.get(name) || "";
  return (
    h("x-forwarded-for").split(",")[0]?.trim() ||
    h("x-real-ip") ||
    h("cf-connecting-ip") ||
    "ip:unknown"
  );
}

// Lazily acquire an Upstash limiter instance if env is present
async function getUpstashLimiter(limit: number, windowSec: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // no redis configured

  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis"),
  ]);

  const redis = new Redis({ url, token });
  // sliding window provides smoother limits
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s` as any),
    analytics: false,
    prefix: "rl",
  });
}

/**
 * Unified helper: rate limit AI calls (chat, index, etc.)
 * Falls back to in-memory limiter if Redis isn’t configured.
 */
export async function ensureAiLimit(req: Request) {
  const key = `ai:${getClientIp(req)}`;
  const upstash = await getUpstashLimiter(AI_LIMIT, Math.round(AI_WINDOW_MS / 1000));
  if (upstash) {
    const { success } = await upstash.limit(key);
    return { ok: !!success };
  }
  // Fallback
  const mem = (globalThis as any).__aiLimiter || new MemoryLimiter(AI_WINDOW_MS, AI_LIMIT);
  (globalThis as any).__aiLimiter = mem;
  return mem.check(key);
}

/**
 * For semantic/keyword search endpoints.
 */
export async function ensureSearchLimit(req: Request) {
  const key = `search:${getClientIp(req)}`;
  const upstash = await getUpstashLimiter(SEARCH_LIMIT, Math.round(SEARCH_WINDOW_MS / 1000));
  if (upstash) {
    const { success } = await upstash.limit(key);
    return { ok: !!success };
  }
  const mem = (globalThis as any).__searchLimiter || new MemoryLimiter(SEARCH_WINDOW_MS, SEARCH_LIMIT);
  (globalThis as any).__searchLimiter = mem;
  return mem.check(key);
}
