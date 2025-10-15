// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// --- Config -------------------------------------------------------------

// Which paths are protected by the middleware
const PROTECTED_PREFIXES = [
  "/api",                 // all APIs
  "/ops",                 // ops portal pages
  "/admin",               // admin pages
];

const ADMIN_PATH_PREFIX = "/admin";

// If Upstash env vars are absent, middleware becomes a safe no-op.
const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const ratelimit = hasUpstash
  ? new Ratelimit({
      redis: redis!,
      // Sliding window: 120 requests / 60s per IP by default
      limiter: Ratelimit.slidingWindow(120, "60 s"),
      analytics: true,
      prefix: "rl:unlistin",
    })
  : null;

// Optionally allow an internal header to bypass rate limit (e.g., trusted cron)
const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

// Admins list (aligned with /lib/auth.ts)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);

// --- Helpers ------------------------------------------------------------

function pathIsProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

function isAdminPath(pathname: string) {
  return pathname.startsWith(ADMIN_PATH_PREFIX);
}

function ipFrom(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.ip ||
    "0.0.0.0"
  );
}

// --- Middleware ---------------------------------------------------------

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only act on protected paths
  if (!pathIsProtected(pathname)) return NextResponse.next();

  // Attach a stable request id for tracing
  const reqId = crypto.randomUUID();

  // Rate limit (skip if internal key present)
  if (
    ratelimit &&
    (!INTERNAL_KEY || req.headers.get("x-internal-key") !== INTERNAL_KEY)
  ) {
    const ip = ipFrom(req);
    const { success, limit, remaining, reset } = await ratelimit.limit(`ip:${ip}`);
    const res = success ? NextResponse.next() : NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
    res.headers.set("x-request-id", reqId);
    res.headers.set("x-ratelimit-limit", String(limit));
    res.headers.set("x-ratelimit-remaining", String(remaining));
    res.headers.set("x-ratelimit-reset", String(reset));
    if (!success) return res;
  }

  // Lightweight admin guard for /admin pages:
  // We do not read cookies here (edge constraint); we rely on server routes to do
  // strong checks. Here we only block obviously unauthenticated clients by header.
  if (isAdminPath(pathname)) {
    const email = req.headers.get("x-user-email")?.toLowerCase() || "";
    if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email)) {
      const res = NextResponse.redirect(new URL("/403", req.url));
      res.headers.set("x-request-id", reqId);
      return res;
    }
  }

  const res = NextResponse.next();
  res.headers.set("x-request-id", reqId);
  return res;
}

// Apply to everything (we gate inside)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
