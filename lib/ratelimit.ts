// lib/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Defaults tuned for India/Asia prod:
 * - 60 requests / minute / user for AI endpoints
 * - 300 requests / 10 minutes burst window (leaky bucket)
 */
export const aiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: true,
  prefix: "rl:ai",
});

export const burstRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, "10 m"),
  analytics: true,
  prefix: "rl:burst",
});

function keyFromReq(req: NextRequest) {
  // Prefer authenticated user id if you attach it to headers,
  // otherwise IP fallback:
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.ip
    || "unknown";
  return ip;
}

export async function ensureAiLimit(req: NextRequest) {
  const key = keyFromReq(req);
  const [ai, burst] = await Promise.all([
    aiRatelimit.limit(key),
    burstRatelimit.limit(key),
  ]);
  const ok = ai.success && burst.success;
  return { ok, ai, burst };
}
