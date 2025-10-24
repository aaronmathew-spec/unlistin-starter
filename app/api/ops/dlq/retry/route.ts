// app/api/ops/dlq/retry/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { retryDLQ } from "@/lib/ops/dlq";
import { assertOpsSecret } from "@/lib/ops/secure";

function bad(status: number, msg: string, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, error: msg, ...(extra || {}) }, { status });
}

export async function POST(req: Request) {
  const forbidden = assertOpsSecret(req);
  if (forbidden) return forbidden;

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = String(body.id || "").trim();
  if (!id) return bad(400, "id_required");

  const out = await retryDLQ(id);
  if (!out.ok) return bad(500, out.error || "retry_failed", out as any);

  return NextResponse.json({ ok: true, ...out });
}
