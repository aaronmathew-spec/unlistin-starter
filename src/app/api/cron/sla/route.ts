// src/app/api/cron/sla/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { checkSlaAndFlagOverdues } from "@/agents/sla/scheduler";

/**
 * Wire this to a Vercel cron (e.g., daily). No auth barrier here by design if you restrict path via Vercel.
 * If you prefer auth, check for a CRON_SECRET header.
 */
export async function GET(_req: NextRequest) {
  try {
    const result = await checkSlaAndFlagOverdues();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[cron/sla] error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
