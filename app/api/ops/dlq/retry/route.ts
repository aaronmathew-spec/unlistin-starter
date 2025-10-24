// app/api/ops/dlq/retry/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { assertOpsSecret } from "@/lib/ops/secure";
import { retryDLQ } from "@/lib/ops/dlq";

function bad(status: number, msg: string, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, error: msg, ...(extra || {}) }, { status });
}

export async function POST(req: Request) {
  const forbidden = assertOpsSecret(req);
  if (forbidden) return forbidden;

  let id = "";
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    id = (body?.id || "").trim();
  } catch {
    // ignore—handled below
  }

  if (!id) return bad(400, "id_required");

  try {
    const out = await retryDLQ(id); // expected shape: { ok: boolean, note?: string, error?: string, ... }

    // Avoid spreading a duplicate 'ok' key
    const { ok, ...rest } = (out || {}) as Record<string, any>;

    if (!ok) {
      return bad(500, rest?.error || "retry_failed", rest);
    }

    return NextResponse.json({ ok: true, ...rest });
  } catch (e: any) {
    return bad(500, String(e?.message || e));
  }
}
