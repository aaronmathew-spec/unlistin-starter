// app/api/ops/system/status/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { gatherSystemStatus } from "@/lib/system/health";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

/**
 * GET /api/ops/system/status
 * Auth: header `x-secure-cron: <SECURE_CRON_SECRET>` (same pattern as other ops endpoints)
 * Returns a JSON bundle of env/config readiness checks for Ops.
 */
export async function GET(req: Request) {
  const hdr = req.headers.get("x-secure-cron") || "";
  if (!OPS_SECRET || hdr !== OPS_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const status = gatherSystemStatus();

  return NextResponse.json(
    {
      ok: status.ok,
      checks: status.checks,
      ts: new Date().toISOString(),
      env: process.env.VERCEL_ENV || "unknown",
      project: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
