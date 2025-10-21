// app/api/ops/verify/recheck/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { assertOpsSecret } from "@/lib/ops/secure";
import { runVerificationRecheck } from "@/lib/verify/recheck";

/**
 * POST /api/ops/verify/recheck
 * Header: x-secure-cron: <SECURE_CRON_SECRET>
 *
 * Runs the verification recheck sweep and returns summary stats.
 */
export async function POST(req: Request) {
  const forbidden = assertOpsSecret(req);
  if (forbidden) return forbidden;

  try {
    const res = await runVerificationRecheck();
    // res shape: { ok, scanned, candidates, updatedNextRecheck, controllers }
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
