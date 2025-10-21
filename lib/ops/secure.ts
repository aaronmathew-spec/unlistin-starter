// lib/ops/secure.ts
import { NextResponse } from "next/server";

const OPS_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();

/** Ensure x-secure-cron header matches your server secret */
export function assertOpsSecret(req: Request): NextResponse | null {
  if (!OPS_SECRET) {
    return NextResponse.json(
      { ok: false, error: "SECURE_CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  const header = (req.headers.get("x-secure-cron") || "").trim();
  if (!header || header !== OPS_SECRET) {
    return NextResponse.json({ ok: false, error: "Invalid secret" }, { status: 403 });
  }
  return null;
}

/** Small helper for consistent JSON responses */
export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}
