// app/api/ops/verify/recheck/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { assertOpsSecret } from "@/lib/ops/secure";

/**
 * POST /api/ops/verify/recheck
 * Header: x-secure-cron: <SECURE_CRON_SECRET>
 *
 * Triggers your verification recheck loop.
 * We optional-import a helper so builds never break.
 */
export async function POST(req: Request) {
  const forbidden = assertOpsSecret(req);
  if (forbidden) return forbidden;

  let recheck: null | ((opts?: { limit?: number }) => Promise<{ checked: number }>) = null;
  try {
    const mod: any = await import("@/lib/verify/recheck");
    if (mod?.recheckDueVerifications) recheck = mod.recheckDueVerifications;
    if (!recheck && mod?.runRecheckCron) recheck = mod.runRecheckCron;
  } catch {
    // module not present — no-op
  }

  if (!recheck) {
    return NextResponse.json({ ok: true, checked: 0, note: "recheck helper not found" });
  }

  const res = await recheck({ limit: 50 }).catch(() => ({ checked: 0 }));
  return NextResponse.json({ ok: true, checked: res.checked || 0 });
}
