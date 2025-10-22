// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// --- Config -------------------------------------------------------------

// Paths the middleware should consider "protected"
const PROTECTED_PREFIXES = [
  "/api",   // all APIs
  "/ops",   // ops portal pages
  "/admin", // admin pages
];

const ADMIN_PATH_PREFIX = "/admin";

// Secure header for cron invocations (Vercel Cron → your API)
// Set SECURE_CRON_SECRET in env (both local and Vercel)
const SECURE_CRON_HEADER = "x-secure-cron";
const SECURE_CRON_SECRET = process.env.SECURE_CRON_SECRET || "";

// If Upstash env vars are absent, middleware becomes a safe no-op for rate limit.
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

// Optionally allow an internal header to bypass rate limit (e.g., trusted internal calls)
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

// Consistent client IP extraction without TS suppression
function ipFrom(req: NextRequest): string {
  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) {
    const first = xfwd.split(",")[0]?.trim();
    if (first) return first;
  }
  // Some runtimes attach ip on the request; use a loose cast without ts-expect-error.
  const anyReq = req as unknown as { ip?: string };
  if (typeof anyReq.ip === "string" && anyReq.ip.length > 0) {
    return anyReq.ip;
  }
  return "0.0.0.0";
}

// Cron-guard: only for specific ops endpoints we call from Vercel Cron
function isCronProtected(pathname: string) {
  if (pathname === "/api/ops/webform/worker") return true;
  if (pathname.startsWith("/api/ops/verify/")) return true;
  return false;
}

// --- Middleware ---------------------------------------------------------

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only act on protected paths
  if (!pathIsProtected(pathname)) return NextResponse.next();

  // Attach a stable request id for tracing
  const reqId = crypto.randomUUID();

  // 1) Cron header guard for specific endpoints (runs before rate limit/admin checks)
  if (isCronProtected(pathname)) {
    const hdr = req.headers.get(SECURE_CRON_HEADER);
    if (!SECURE_CRON_SECRET || hdr !== SECURE_CRON_SECRET) {
      const res = new NextResponse("Forbidden", { status: 403 });
      res.headers.set("x-request-id", reqId);
      return res;
    }
  }

  // 2) Rate limit (skip if internal key present)
  if (
    ratelimit &&
    (!INTERNAL_KEY || req.headers.get("x-internal-key") !== INTERNAL_KEY)
  ) {
    const ip = ipFrom(req);
    const { success, limit, remaining, reset } = await ratelimit.limit(`ip:${ip}`);
    const res = success
      ? NextResponse.next()
      : NextResponse.json({ error: "Too many requests" }, { status: 429 });
    res.headers.set("x-request-id", reqId);
    res.headers.set("x-ratelimit-limit", String(limit));
    res.headers.set("x-ratelimit-remaining", String(remaining));
    res.headers.set("x-ratelimit-reset", String(reset));
    if (!success) return res;
  }

  // 3) Lightweight admin guard for /admin pages:
  // (Strong auth still enforced in server routes; this is an early block.)
  if (isAdminPath(pathname)) {
    const email = req.headers.get("x-user-email")?.toLowerCase() || "";
    if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email)) {
      const res = NextResponse.redirect(new URL("/403", req.url));
      res.headers.set("x-request-id", reqId);
      return res;
    }
  }

  // 4) Security headers can be set in route handlers; keep middleware lean.
  const res = NextResponse.next();
  res.headers.set("x-request-id", reqId);
  return res;
}

// Apply to everything (we gate inside)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
