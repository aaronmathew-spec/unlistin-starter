// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * ==========================
 * Paths / constants
 * ==========================
 */
const OPS_COOKIE = "ops";
const OPS_LOGIN_PATH = "/ops/login";
const CRON_PATH = "/api/ops/targets/dispatch";

/**
 * ==========================
 * Route helpers
 * ==========================
 */
function needsOpsGate(pathname: string): boolean {
  if (!pathname.startsWith("/ops")) return false;
  if (pathname === OPS_LOGIN_PATH) return false; // allow the login page itself
  return true;
}

function isCronPath(pathname: string): boolean {
  return pathname === CRON_PATH;
}

/**
 * ==========================
 * Content Security Policy
 * ==========================
 * Works with:
 * - Next.js (allows 'unsafe-inline' for styles only)
 * - Supabase (REST, Realtime websockets, Storage)
 * - Vercel Analytics/Speed Insights (optional)
 */
function buildCSP() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const supabaseOrigins = SUPABASE_URL
    ? [
        SUPABASE_URL,
        `${SUPABASE_URL.replace("https://", "wss://")}`, // realtime ws
        `${SUPABASE_URL}/auth`,
        `${SUPABASE_URL}/rest`,
        `${SUPABASE_URL}/storage`,
      ]
    : [];

  const vercel = ["https://vitals.vercel-insights.com"];
  const self = "'self'";

  const directives: Record<string, string[]> = {
    "default-src": [self],
    "style-src": [self, "'unsafe-inline'"],
    "img-src": [self, "data:", "blob:", ...supabaseOrigins],
    "script-src": [self], // no inline scripts
    "font-src": [self, "data:"],
    "connect-src": [
      self,
      "https://*.vercel.app",
      "https://*.vercel.dev",
      ...vercel,
      ...supabaseOrigins,
    ],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": [self],
    "form-action": [self],
    "frame-src": [],
    "media-src": [self, "blob:", ...supabaseOrigins],
    "worker-src": [self, "blob:"],
    "manifest-src": [self],
    "upgrade-insecure-requests": [],
  };

  return Object.entries(directives)
    .map(([key, vals]) => (vals.length ? `${key} ${vals.join(" ")}` : key))
    .join("; ");
}

/**
 * ==========================
 * Baseline security headers
 * ==========================
 */
const securityHeaders: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "Cross-Origin-Embedder-Policy": "unsafe-none",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "accelerometer=()",
    "autoplay=()",
    "gyroscope=()",
    "magnetometer=()",
    "xr-spatial-tracking=()",
  ].join(", "),
};

function applySecurityHeaders(res: NextResponse) {
  for (const [k, v] of Object.entries(securityHeaders)) {
    res.headers.set(k, v);
  }
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildCSP();
  if (isDev) {
    res.headers.set("Content-Security-Policy-Report-Only", csp);
  } else {
    res.headers.set("Content-Security-Policy", csp);
  }
  res.headers.set("Server-Timing", "middleware;desc=security-headers;dur=0.1");
  return res;
}

/**
 * ==========================
 * Middleware
 * ==========================
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ---- Edge guard for cron-only endpoint (header secret) ----
  if (isCronPath(pathname)) {
    // Allow preflight for good measure
    if (req.method === "OPTIONS") {
      const pre = new NextResponse(null, { status: 204 });
      return applySecurityHeaders(pre);
    }

    const expected = (process.env.SECURE_CRON_SECRET || "").trim();
    const provided = (req.headers.get("x-secure-cron") || "").trim();

    if (!expected || !provided || expected !== provided) {
      const deny = NextResponse.json(
        { ok: false, error: "unauthorized_cron" },
        { status: 401 },
      );
      return applySecurityHeaders(deny);
    }
    // fall-through to apply headers and continue
  }

  // ---- Ops gate (only for /ops pages) ----
  if (needsOpsGate(pathname)) {
    const configuredToken = (process.env.OPS_DASHBOARD_TOKEN || "").trim();
    const cookieValue = (req.cookies.get(OPS_COOKIE)?.value || "").trim();

    // If missing/mismatch, redirect to login with ?next=
    if (!configuredToken || cookieValue !== configuredToken) {
      const url = req.nextUrl.clone();
      url.pathname = OPS_LOGIN_PATH;
      if (pathname) url.searchParams.set("next", pathname + (search || ""));
      const redirect = NextResponse.redirect(url);
      return applySecurityHeaders(redirect);
    }
  }

  // ---- Normal pass-through + headers for everything else ----
  const res = NextResponse.next();
  return applySecurityHeaders(res);
}

/**
 * Match all routes except Next internals and static assets.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
