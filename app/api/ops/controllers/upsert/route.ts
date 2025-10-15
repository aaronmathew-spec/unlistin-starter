// app/api/ops/controllers/upsert/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { upsertControllerMeta } from "@/lib/controllers/store";
import type { PreferredChannel } from "@/lib/controllers/meta";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

export async function POST(req: Request) {
  const hdr = req.headers.get("x-secure-cron") || "";
  if (!OPS_SECRET || hdr !== OPS_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    key?: string;
    preferred?: PreferredChannel;
    slaTargetMin?: number;
    formUrl?: string;
  };

  if (!body.key || !body.preferred || typeof body.slaTargetMin !== "number") {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  await upsertControllerMeta({
    key: body.key,
    preferred: body.preferred,
    slaTargetMin: body.slaTargetMin,
    formUrl: body.formUrl,
  });

  return NextResponse.json({ ok: true });
}
