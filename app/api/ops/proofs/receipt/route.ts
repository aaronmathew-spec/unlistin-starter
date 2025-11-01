/* app/api/ops/proofs/receipt/route.ts
 * POST (ops-only): { job_id } -> upsert receipt by hashing current artifacts
 * GET  (ops-only): ?job_id=... -> return stored receipt row
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { makeArtifactReceipt } from "@/src/lib/crypto/receipts";
import { createClient } from "@supabase/supabase-js";

const OPS = (process.env.SECURE_CRON_SECRET || "").trim();
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SR = process.env.SUPABASE_SERVICE_ROLE || "";

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

  const res = await makeArtifactReceipt(jobId);
  if (!res.ok) {
    return NextResponse.json(res, { status: 500 });
  }
  return NextResponse.json(res);
}

export async function GET(req: Request) {
  const hdr = (req.headers.get("x-secure-cron") || "").trim();
  if (!OPS) return forbid("secret_not_configured");
  if (hdr !== OPS) return forbid("invalid_secret");

  const url = new URL(req.url);
  const jobId = String(url.searchParams.get("job_id") || "").trim();
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "missing_job_id" }, { status: 400 });
  }

  const sb = createClient(URL, SR, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("ops_artifact_receipts")
    .select("job_id, html_sha256, screenshot_sha256, created_at")
    .eq("job_id", jobId)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "receipt_not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, receipt: data });
}
