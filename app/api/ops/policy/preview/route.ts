// app/api/ops/policy/preview/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getControllerPolicy } from "@/src/agents/policy";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

export async function GET(req: Request) {
  if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
  const header = req.headers.get("x-secure-cron") || "";
  if (header !== OPS_SECRET) return forbidden("Invalid secret");

  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") || "generic").toLowerCase();

  const policy = getControllerPolicy(key);
  return NextResponse.json({ ok: true, policy });
}
