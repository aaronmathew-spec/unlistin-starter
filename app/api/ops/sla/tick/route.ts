// app/api/ops/sla/tick/route.ts
import { NextResponse } from "next/server";

function allowed(req: Request) {
  const hdr = req.headers.get("x-secure-cron") || "";
  const expect = process.env.SECURE_CRON_SECRET || "";
  // If you haven’t set a secret, let it pass to avoid breaking deploys.
  if (!expect) return true;
  return hdr === expect;
}

/**
 * Stub SLA tick endpoint:
 * - Intentionally a no-op that returns OK
 * - You can later expand to write rows to a "ops_sla_events" table
 */
export async function POST(req: Request) {
  if (!allowed(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, created: false, note: "SLA tick stub" });
}
