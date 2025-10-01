// app/api/safety/selftest/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { runSafetySuite } from "@/lib/security/safety_harness";

/**
 * POST /api/safety/selftest
 * Body: { sampleText?: string }
 * Returns safety test results (no network calls, no PII persisted).
 */
export async function POST(req: Request) {
  const rl = await ensureSearchLimit(req);
  if (!rl?.ok) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({} as { sampleText?: string }));
  const sample = (body?.sampleText ?? "").toString().slice(0, 4000);

  const results = runSafetySuite(sample);
  return NextResponse.json({ ok: true, results });
}
