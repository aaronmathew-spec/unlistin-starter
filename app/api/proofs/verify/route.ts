// app/api/proofs/verify/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyLedgerRecord } from "@/lib/crypto/verify";
import { verifySignedBundle } from "@/lib/proofs/verify";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/**
 * POST /api/proofs/verify
 *
 * Supports two modes:
 * 1) JSON body: { id: string }   -> verifies a ledger record by ID (existing behavior)
 * 2) ZIP bundle upload:
 *    - Content-Type: application/zip (raw body)
 *    - OR multipart/form-data with 'file' field containing the zip
 *    -> verifies KMS/Ed25519 signed bundle produced by /api/proofs/[subjectId]/export
 */
export async function POST(req: Request) {
  const contentType = (req.headers.get("content-type") || "").toLowerCase().trim();

  // --- Mode 2A: Raw zip body (application/zip or application/octet-stream) ---
  if (
    contentType.startsWith("application/zip") ||
    contentType.startsWith("application/octet-stream")
  ) {
    try {
      const ab = await req.arrayBuffer();
      const bundle = new Uint8Array(ab);
      const result = await verifySignedBundle(bundle);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[proofs.verify.bundle_raw.error]", String(e?.message || e));
      return bad(500, "bundle_verify_failed");
    }
  }

  // --- Mode 2B: Multipart upload with a 'file' field ---
  if (contentType.startsWith("multipart/form-data")) {
    try {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return bad(400, "file_not_found");
      const bundle = new Uint8Array(await file.arrayBuffer());
      const result = await verifySignedBundle(bundle);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[proofs.verify.bundle_multipart.error]", String(e?.message || e));
      return bad(500, "bundle_verify_failed");
    }
  }

  // --- Mode 1: Existing JSON { id } flow (ledger record verify) ---
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return bad(500, "Supabase env missing");

  // If not multipart/zip, assume JSON body with { id }
  const body = (await req.json().catch(() => ({}))) as any;
  const id = (body?.id || "").toString().trim();
  if (!id) return bad(400, "Provide id");

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data, error } = await sb
    .from("proof_ledger")
    .select("id, root_hex, algorithm, key_id, signature_b64")
    .eq("id", id)
    .single();

  if (error || !data) return bad(404, "record_not_found");

  const verified = await verifyLedgerRecord(data as any);
  return NextResponse.json({ ok: true, id: data.id, verified });
}
