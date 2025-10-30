/* app/api/cron/ops-webform/route.ts
 * Relay for Vercel Cron → adds x-secure-cron, then calls /api/ops/webform/worker (POST)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const OPS_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();

function bad(msg: string, status = 500) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET() {
  if (!OPS_SECRET) return bad("SECURE_CRON_SECRET not configured", 500);

  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "";
  const url =
    (base
      ? `${base.replace(/\/$/, "")}/api/ops/webform/worker`
      : `/api/ops/webform/worker`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-secure-cron": OPS_SECRET,
        "content-type": "application/json",
      },
      // never cache a worker pulse
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    return NextResponse.json(
      { ok: res.ok, status: res.status, ...json },
      { status: res.ok ? 200 : res.status }
    );
  } catch (e: any) {
    return bad(String(e?.message || e));
  }
}
