// Secure-cron guard for internal fan-out APIs
// - Validates the `x-secure-cron` header against SECURE_CRON_SECRET
// - Optional secondary secret via SECURE_CRON_ALT_SECRET (useful for staged rotations)
// - Adds small helpers for IP extraction and building internal headers
//
// Usage in a route:
//   import { assertSecureCron, getClientIp } from "@/lib/ops/secure-cron";
//   const headers = assertSecureCron(request); // throws Response(401) if not authorized
//   const ip = getClientIp(headers);
//
// For internal calls to your own secure-cron API:
//   import { buildSecureCronHeaders } from "@/lib/ops/secure-cron";
//   const res = await fetch("/api/ops/targets/dispatch", {
//     method: "POST",
//     headers: buildSecureCronHeaders({ "content-type": "application/json" }),
//     body: JSON.stringify(payload),
//   });

import { required } from "@/lib/env";
import crypto from "crypto";

function timingSafeEqual(a: string, b: string): boolean {
  // Constant-time compare when lengths match; otherwise fail fast
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Throws a 401 Response if the request isn't authorized.
 * Returns a cloned Headers object on success (so you can inspect forwarded headers safely).
 */
export function assertSecureCron(req: Request): Headers {
  const headers = new Headers(req.headers);
  const incoming = (headers.get("x-secure-cron") || "").trim();

  // Primary secret (required)
  const primary = required("SECURE_CRON_SECRET").trim();
  // Optional secondary secret to allow smooth rotations
  const secondary = (process.env.SECURE_CRON_ALT_SECRET || "").trim();

  const ok =
    (incoming && timingSafeEqual(incoming, primary)) ||
    (!!secondary && incoming && timingSafeEqual(incoming, secondary));

  if (!ok) {
    throw new Response("Unauthorized (secure-cron)", { status: 401 });
  }
  return headers;
}

/** Best-effort client IP extraction (works behind Vercel/Proxies). */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "0.0.0.0";
}

/** Helper to build headers for internal secure-cron calls. */
export function buildSecureCronHeaders(extra?: Record<string, string>): HeadersInit {
  const secret = required("SECURE_CRON_SECRET");
  return {
    "x-secure-cron": secret,
    ...(extra || {}),
  };
}
