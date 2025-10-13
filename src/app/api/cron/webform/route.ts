// src/app/api/cron/webform/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron/auth";
import { processNextWebformJobs } from "@/agents/dispatch/webformWorker";

/**
 * POST = run a bounded batch of webform jobs
 * Auth: HMAC via x-cron-timestamp + x-cron-signature
 */
export async function POST(req: NextRequest) {
  try {
    const auth = requireCronAuth(req as unknown as Request);
    if (!auth.ok) {
      return NextResponse.json({ error: "Forbidden", reason: auth.reason }, { status: 403 });
    }

    const batchSize = Number(process.env.WEBFORM_WORKER_BATCH || 3);
    const res = await processNextWebformJobs(batchSize);

    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[cron/webform] error:", e?.message || e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET = quick health probe
 * Auth: same HMAC headers
 */
export async function GET(req: NextRequest) {
  try {
    const auth = requireCronAuth(req as unknown as Request);
    if (!auth.ok) {
      return NextResponse.json({ error: "Forbidden", reason: auth.reason }, { status: 403 });
    }
    return NextResponse.json({ ok: true, status: "ready" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 500 });
  }
}
