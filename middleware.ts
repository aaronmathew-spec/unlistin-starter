// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Build a conservative CSP that works with:
 * - Next.js (self, inline styles via 'unsafe-inline' for critical CSS)
 * - Supabase (REST, Realtime websockets, Storage)
 * - Vercel Analytics/Speed Insights (optional; comment out if unused)
 *
 * NOTE: If you use other 3rd parties (fonts, maps, cdn), add them below.
 */
function buildCSP() {
  // Supabase URL(s) available at build time
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  // Supabase RT and Storage share the same origin base
  const supabaseOrigins = SUPABASE_URL
    ? [
        SUPABASE_URL,
        `${SUPABASE_URL.replace("https://", "wss://")}`, // realtime ws
        `${SUPABASE_URL}/auth`,
        `${SUPABASE_URL}/rest`,
        `${SUPABASE_URL}/storage`,
      ]
    : [];

  // If you use Google Fonts, uncomment these:
  // const googleFonts = [
  //   "https://fonts.googleapis.com",
  //   "https://fonts.gstatic.com",
  // ];

  // If you use Vercel analytics/speed-insights, keep these. Otherwise remove.
  const vercel = ["https://vitals.vercel-insights.com"];

  const self = "'self'";

  // Keep CSP readable. Join arrays at the end.
  const directives: Record<string, string[]> = {
    "default-src": [self],
    // Next.js inlines some styles during SSR; allow 'unsafe-inline' for styles only.
    "style-src": [self, "'unsafe-inline'"],
    "img-src": [self, "data:", "blob:", ...supabaseOrigins],
    // Next needs blob: for certain runtime features; Supabase uses websockets.
    "script-src": [self], // No 'unsafe-inline' for scripts — safer.
    "font-src": [self, "data:" /*, ...googleFonts*/],
    "connect-src": [
      self,
      "https://*.vercel.app",
      "https://*.vercel.dev",
      ...vercel,
      ...supabaseOrigins,
    ],
    "frame-ancestors": ["'none'"], // disallow embedding
    "object-src": ["'none'"],
    "base-uri": [self],
    "form-action": [self],
    "frame-src": [], // keep empty unless you intentionally embed frames
    "media-src": [self, "blob:", ...supabaseOrigins],
    "worker-src": [self, "blob:"],
    "manifest-src": [self],
    "upgrade-insecure-requests": [], // auto-upgrade http->https when possible
  };

  // turn into a single header string
  return Object.entries(directives)
    .map(([key, vals]) => (vals.length ? `${key} ${vals.join(" ")}` : key))
    .join("; ");
}

/**
 * Common security headers (OWASP-ish baseline)
 */
const securityHeaders: Record<string, string> = {
  // HSTS (only when site is HTTPS + stable on a subdomain you control)
  // If you test on http://localhost these are harmless; browsers ignore HSTS on http.
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  // Avoid MIME sniffing
  "X-Content-Type-Options": "nosniff",
  // Clickjacking protection
  "X-Frame-Options": "DENY",
  // Legacy XSS filter (modern browsers ignore or treat as 0)
  "X-XSS-Protection": "0",
  // COOP/COEP/CORP harden cross-origin isolation (tune if you embed 3rd-party iframes)
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  // COEP can break some embeds; start with unsafe-none. If you need SharedArrayBuffer, change to require-corp.
  "Cross-Origin-Embedder-Policy": "unsafe-none",
  // Referrer policy
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Permissions policy (formerly Feature-Policy) — disable sensitive sensors by default
  "Permissions-Policy":
    [
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

export function middleware(req: NextRequest) {
  // Let Next handle static assets quickly; we still set headers for pages/APIs below.
  const res = NextResponse.next();

  // 1) Set baseline headers
  for (const [k, v] of Object.entries(securityHeaders)) {
    res.headers.set(k, v);
  }

  // 2) Content Security Policy
  // In dev, it’s useful to start with Report-Only so you can see violations without breaking pages.
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildCSP();

  if (isDev) {
    res.headers.set("Content-Security-Policy-Report-Only", csp);
  } else {
    res.headers.set("Content-Security-Policy", csp);
  }

  // 3) Cache busting for middleware changes (optional)
  res.headers.set("Server-Timing", "middleware;desc=security-headers;dur=0.1");

  return res;
}

/**
 * Match all routes except Next internals and assets.
 * Adjust the matcher if you need headers on images too (usually unnecessary).
 */
export const config = {
  matcher: [
    // Apply to all application routes & API routes:
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
