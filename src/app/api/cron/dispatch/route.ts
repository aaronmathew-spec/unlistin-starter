// src/app/api/cron/dispatch/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/server/cronAuth";
import { dispatchAllDue } from "@/agents/dispatch/send";

export async function POST(req: Request) {
  try {
    assertCronAuth(req);
    await dispatchAllDue();
    return NextResponse.json({ ok: true, ran: "dispatchAllDue" });
  } catch (err: any) {
    const status = (err as any)?.status || 500;
    return NextResponse.json({ error: err?.message || "Internal error" }, { status });
  }
}

export async function GET(req: Request) {
  // Allow GET for health checks if you prefer; still requires secret.
  return POST(req);
}
