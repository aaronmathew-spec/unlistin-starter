/* app/api/ops/proofs/verify/route.ts
 * POST (ops-only): { job_id } -> recompute hashes and compare to stored receipt
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { verifyArtifactReceipt } from "@/src/lib/crypto/receipts";

const OPS = (process.env.SECURE_CRON_SECRET || "").trim();

function forbid(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

export async function POST(req: Request) {
  const hdr = (req.headers.get("x-secure-cron") || "").trim();
  if (!OPS) return forbid("secret_not_configured");
  if (hdr !== OPS) return forbid("invalid_secret");

  const body = await req.json().catch(() => ({}));
  const jobId = String(body?.job_id || "").trim();
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "missing_job_id" }, { status: 400 });
  }

  const res = await verifyArtifactReceipt(jobId);
  if (res.ok === false && "error" in res) {
    return NextResponse.json(res, { status: 404 });
  }
  return NextResponse.json(res);
}
