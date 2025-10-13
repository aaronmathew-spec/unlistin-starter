// src/app/api/cron/verify/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/server/cronAuth";
import { verifyAllDue } from "@/agents/verification/sweep";

export async function POST(req: Request) {
  try {
    assertCronAuth(req);
    const res = await verifyAllDue(200); // bounded sweep
    return NextResponse.json({ ok: true, ran: "verifyAllDue", ...res });
  } catch (err: any) {
    const status = (err as any)?.status || 500;
    return NextResponse.json({ error: err?.message || "Internal error" }, { status });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
