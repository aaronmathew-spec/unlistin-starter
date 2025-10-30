// app/api/ops/webform/enqueue/route.ts
import { NextResponse } from "next/server";
import { assertSecureCron } from "@/lib/ops/secure-cron";
import { enqueueWebformJob } from "@/lib/webform/queue";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertSecureCron(req);
  } catch (e) {
    return e instanceof Response ? e : NextResponse.json({ ok: false, error: "unauthorized_cron" }, { status: 403 });
  }

  try {
    const body = await req.json();
    await enqueueWebformJob(body);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
