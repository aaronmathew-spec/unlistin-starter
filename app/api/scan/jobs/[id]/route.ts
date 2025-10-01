// app/api/scan/jobs/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { getDeepScanJob } from "@/lib/deepscan-jobs";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const job = await getDeepScanJob(params.id);
  if (!job) return json({ error: "Not found" }, { status: 404 });
  return json({
    id: job.id,
    status: job.status,
    pct: job.pct,
    results: job.results ?? [],
    error: job.error ?? null,
  });
}
