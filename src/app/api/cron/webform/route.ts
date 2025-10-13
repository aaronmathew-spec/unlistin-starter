// src/app/api/cron/webform/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { processNextWebformJobs } from "@/agents/dispatch/webformWorker";
import { assertCronAuth } from "@/lib/server/cronAuth";

export async function POST(req: Request) {
  try {
    assertCronAuth(req);
    const res = await processNextWebformJobs(3);
    return NextResponse.json({ ok: true, ...res });
  } catch (err: any) {
    const status = (err as any)?.status || 500;
    return NextResponse.json({ error: err?.message || "Internal error" }, { status });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
