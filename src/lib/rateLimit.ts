/**
 * Lightweight rate limiting helpers for server-only routes.
 * Backed by Upstash Redis via `@upstash/ratelimit` + `@upstash/redis`.
 *
 * ✅ Safe defaults when Redis envs are missing (NO-OP / always allow)
 * ✅ Backward compatible: preserves `checkRate(key)` export
 * ✅ Convenience helpers: `rateLimitByKey`, `tryConsume`, `tooMany`
 *
 * NOTE: Do not import Upstash's types (they vary by version). We normalize the
 *       response shape ourselves to avoid type drift across package versions.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/** Whether Upstash is configured (otherwise, helpers will fail-open / allow). */
export const limiterEnabled =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

/** Singleton Redis client (created only if envs are present). */
const redis = limiterEnabled
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL as string,
      token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    })
  : null;

/** Defaults can be overridden via ENV (optional). */
const DEFAULT_MAX = Number.parseInt(process.env.RATE_LIMIT_MAX_PER_MIN ?? "60", 10); // 60 req/min
const DEFAULT_WINDOW_SEC = Number.parseInt(process.env.RATE_LIMIT_WINDOW_SEC ?? "60", 10); // 60s window
const DEFAULT_PREFIX = process.env.RATE_LIMIT_PREFIX || "unlistin:rl:";

/** Cache Ratelimit instances by (max, windowSec, prefix) to avoid re-creating. */
const limiterCache = new Map<string, Ratelimit>();

function cacheKey(max: number, windowSec: number, prefix: string) {
  return `${max}:${windowSec}:${prefix}`;
}

/**
 * Build (or retrieve from cache) a sliding-window limiter instance.
 * Uses seconds granularity to match typical API rate limits.
 */
function getLimiter(opts?: { max?: number; windowSec?: number; prefix?: string }): Ratelimit | null {
  if (!redis) return null;
  const max = Math.max(1, Math.floor(opts?.max ?? DEFAULT_MAX));
  const windowSec = Math.max(1, Math.floor(opts?.windowSec ?? DEFAULT_WINDOW_SEC));
  const prefix = opts?.prefix ?? DEFAULT_PREFIX;
  const key = cacheKey(max, windowSec, prefix);

  const existing = limiterCache.get(key);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
    analytics: false,
    prefix,
  });

  limiterCache.set(key, limiter);
  return limiter;
}

/** Upstash response (normalized locally to avoid version/type drift). */
type NormalizedLimit = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch seconds
};

/** Convert any Upstash response shape into our stable NormalizedLimit. */
function normalize(res: any, fallback: { limit: number; windowSec: number }): NormalizedLimit {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    success: !!res?.success,
    limit: Number.isFinite(res?.limit) ? Number(res.limit) : fallback.limit,
    remaining: Math.max(0, Number(res?.remaining ?? 0)),
    reset: Number.isFinite(res?.reset) ? Number(res.reset) : nowSec + fallback.windowSec,
  };
}

/**
 * Backward-compatible API (kept to avoid breaking existing imports).
 * Default: 60 requests / 60s window per key (configurable via ENV).
 *
 * Returns the raw (untyped) Upstash response when enabled,
 * or `{ success: true }` when disabled (NO-OP).
 */
export async function checkRate(
  key: string,
  opts?: { max?: number; windowSec?: number; prefix?: string }
): Promise<any | { success: true }> {
  const limiter = getLimiter(opts);
  if (!limiter) return { success: true };
  const res = await limiter.limit(key); // don't type-import; shapes differ by package version
  return res;
}

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number; // epoch seconds until the window resets
  limit?: number;
};

/**
 * Friendly wrapper that normalizes the result shape used by routes.
 * - allowed: whether the request should proceed
 * - remaining: remaining tokens in the current window (0 when blocked)
 * - reset: unix timestamp (seconds) when the window resets
 */
export async function rateLimitByKey(
  key: string,
  opts?: { max?: number; windowSec?: number; prefix?: string }
): Promise<RateLimitResult> {
  const limiter = getLimiter(opts);
  const max = Math.max(1, Math.floor(opts?.max ?? DEFAULT_MAX));
  const windowSec = Math.max(1, Math.floor(opts?.windowSec ?? DEFAULT_WINDOW_SEC));

  if (!limiter) {
    const now = Math.floor(Date.now() / 1000);
    return { allowed: true, remaining: max, reset: now + windowSec, limit: max };
  }

  const raw = await limiter.limit(key);
  const res = normalize(raw, { limit: max, windowSec });

  return {
    allowed: !!res.success,
    remaining: res.remaining,
    reset: res.reset,
    limit: res.limit,
  };
}

/** Convenience boolean helper. */
export async function tryConsume(
  key: string,
  max = DEFAULT_MAX,
  windowSec = DEFAULT_WINDOW_SEC,
  prefix = DEFAULT_PREFIX
): Promise<boolean> {
  const { allowed } = await rateLimitByKey(key, { max, windowSec, prefix });
  return allowed;
}

/**
 * Standard 429 response with Retry-After header.
 * Pass in the `reset` (epoch seconds) you got from `rateLimitByKey`.
 */
export function tooMany(meta?: Partial<RateLimitResult>) {
  const nowSec = Math.floor(Date.now() / 1000);
  const resetSec = Math.max(nowSec + 1, Number(meta?.reset ?? nowSec + DEFAULT_WINDOW_SEC));
  const retryAfter = Math.max(1, resetSec - nowSec);

  return new Response("Too Many Requests", {
    status: 429,
    headers: {
      "retry-after": String(retryAfter),
      "content-type": "text/plain; charset=utf-8",
      "x-rate-limit-remaining": String(Math.max(0, Number(meta?.remaining ?? 0))),
      ...(meta?.limit != null ? { "x-rate-limit-limit": String(meta.limit) } : {}),
      "x-rate-limit-reset": String(resetSec),
    },
  });
}

/* ----------------------------- Notes & ENV -----------------------------
 * Required for enabling the limiter (otherwise it NO-OPs):
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 *
 * Optional tuning (safe defaults provided):
 * - RATE_LIMIT_MAX_PER_MIN   (default "60")
 * - RATE_LIMIT_WINDOW_SEC    (default "60")
 * - RATE_LIMIT_PREFIX        (default "unlistin:rl:")
 * ---------------------------------------------------------------------- */
