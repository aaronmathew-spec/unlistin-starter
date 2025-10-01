// lib/ratelimit.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Ratelimit as UpstashRateLimitType } from "@upstash/ratelimit";

// ---------- Small utilities ----------

export function getClientIp(req: Request): string {
  const h = (name: string) => req.headers.get(name) || "";
  return (
    h("x-forwarded-for").split(",")[0]?.trim() ||
    h("x-real-ip") ||
    h("cf-connecting-ip") ||
    "ip:unknown"
  );
}

function envInt(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ---------- In-memory fallback limiter (for dev / no-Redis) ----------

class MemoryLimiter {
  private map = new Map<string, { count: number; resetAt: number }>();
  constructor(private windowMs: number, private limit: number) {}

  check(key: string) {
    const now = Date.now();
    const slot = this.map.get(key);
    if (!slot || now > slot.resetAt) {
      this.map.set(key, { count: 1, resetAt: now + this.windowMs });
      return { ok: true, remaining: this.limit - 1, reset: now + this.windowMs };
    }
    if (slot.count >= this.limit) {
      return { ok: false, remaining: 0, reset: slot.resetAt };
    }
    slot.count += 1;
    return { ok: true, remaining: this.limit - slot.count, reset: slot.resetAt };
  }
}

// ---------- Lazy Upstash client (when configured) ----------

async function getUpstashLimiter(limit: number, windowSec: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis"),
  ]);

  const redis = new Redis({ url, token });
  // Sliding window = smoother user experience
  const limiter: UpstashRateLimitType = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s` as any),
    analytics: false,
    prefix: "rl",
  });

  return limiter;
}

// ---------- Public API ----------

/**
 * Generic rate limit. Throws a 429 Error on exceed.
 * keyOrReq:
 *   - string: treated as the full key
 *   - Request: key will be `${prefix}:${clientIp}`
 */
export async function ensureRateLimit(
  keyOrReq: string | Request,
  max: number,
  windowSec: number,
  prefix = "generic"
) {
  const key =
    typeof keyOrReq === "string" ? keyOrReq : `${prefix}:${getClientIp(keyOrReq)}`;

  // Upstash first (if configured)
  const up = await getUpstashLimiter(max, windowSec);
  if (up) {
    const { success, remaining, reset } = await up.limit(key);
    if (!success) {
      const seconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      const err: any = new Error(`Rate limit exceeded. Retry in ~${seconds}s`);
      err.status = 429;
      err.remaining = remaining;
      err.retryAfter = seconds;
      throw err;
    }
    return { remaining, reset };
  }

  // Memory fallback
  const windowMs = windowSec * 1000;
  const storeName = `__memLimiter_${prefix}_${max}_${windowSec}`;
  const mem: MemoryLimiter =
    (globalThis as any)[storeName] || new MemoryLimiter(windowMs, max);
  (globalThis as any)[storeName] = mem;

  const res = mem.check(key);
  if (!res.ok) {
    const seconds = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
    const err: any = new Error(`Rate limit exceeded. Retry in ~${seconds}s`);
    err.status = 429;
    err.remaining = 0;
    err.retryAfter = seconds;
    throw err;
  }
  return { remaining: res.remaining, reset: res.reset };
}

/**
 * Opinionated limiter for AI endpoints.
 * Defaults can be tuned with env:
 *   AI_RATE_MAX (default 30), AI_RATE_WINDOW (seconds, default 60)
 */
export async function ensureAiLimit(req: Request) {
  const max = envInt(process.env.AI_RATE_MAX, 30);
  const windowSec = envInt(process.env.AI_RATE_WINDOW, 60);
  return ensureRateLimit(req, max, windowSec, "ai");
}

/**
 * Limiter for search endpoints.
 * Env overrides:
 *   SEARCH_RATE_MAX (default 60), SEARCH_RATE_WINDOW (seconds, default 60)
 */
export async function ensureSearchLimit(req: Request) {
  const max = envInt(process.env.SEARCH_RATE_MAX, 60);
  const windowSec = envInt(process.env.SEARCH_RATE_WINDOW, 60);
  return ensureRateLimit(req, max, windowSec, "search");
}
