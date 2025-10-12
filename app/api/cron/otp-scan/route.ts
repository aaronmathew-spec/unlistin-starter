/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

function envBool(v?: string) { return v === "1" || v?.toLowerCase() === "true"; }

/**
 * Vercel Cron calls GET by default.
 * We accept both GET (cron) and POST (manual).
 * Set CRON_SECRET in Vercel and VERCEL will not include it; we expect you
 * to set it as a header when calling manually (X-Cron-Secret).
 * For Vercel Cron protection you can also allow empty header (optional).
 */
async function doScan() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const res = await fetch(`${base}/api/otp/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // scan the last 10 minutes and cap work so cron stays snappy
    body: JSON.stringify({ since_minutes: 10, limit: 50 }),
    // best effort; don't reject on non-2xx
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

export async function GET(req: NextRequest) {
  if (!envBool(process.env.FEATURE_MAILROOM)) {
    return NextResponse.json({ error: "mailroom disabled" }, { status: 503 });
  }
  // Optional header check (keep simple for now)
  const wantSecret = (process.env.CRON_SECRET || "").trim();
  if (wantSecret) {
    const got = (req.headers.get("x-cron-secret") || "").trim();
    if (got !== wantSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const out = await doScan();
  return NextResponse.json({ ok: true, ...out });
}

export async function POST(req: NextRequest) {
  // allow manual trigger with same secret header
  const wantSecret = (process.env.CRON_SECRET || "").trim();
  if (wantSecret) {
    const got = (req.headers.get("x-cron-secret") || "").trim();
    if (got !== wantSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const out = await doScan();
  return NextResponse.json({ ok: true, ...out });
}
