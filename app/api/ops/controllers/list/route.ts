// app/api/ops/controllers/list/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { listControllerMetas } from "@/lib/controllers/store";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

export async function GET(req: Request) {
  const hdr = req.headers.get("x-secure-cron") || "";
  if (!OPS_SECRET || hdr !== OPS_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const items = await listControllerMetas();
  return NextResponse.json({ ok: true, items });
}
