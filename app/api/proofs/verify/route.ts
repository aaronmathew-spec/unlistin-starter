// app/api/proofs/verify/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyLedgerRecord } from "@/lib/crypto/verify";
import { verifySignedBundle } from "@/lib/proofs/verify";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

function bad(status: number, msg: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: msg, ...(extra || {}) }, { status });
}

/**
 * POST /api/proofs/verify
 *
 * Modes:
 *  1) Bundle upload (preferred):
 *     a) Content-Type: application/zip OR application/octet-stream  (raw body)
 *     b) Content-Type: multipart/form-data with `file` field        (form-data)
 *     -> Verifies KMS/Ed25519 signed bundle produced by /api/proofs/[subjectId]/export
 *
 *  2) Legacy JSON by id:
 *     Content-Type: application/json
 *     Body: { "id": "<proof_ledger.id>" }
 *     -> Loads record from DB and verifies its signature fields.
 */
export async function POST(req: Request) {
  const contentType = (req.headers.get("content-type") || "").toLowerCase().trim();

  // --- Mode 1A: Raw zip body (zip/octet-stream) ---
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
      return bad(500, "bundle_verify_failed", { detail: String(e?.message || e) });
    }
  }

  // --- Mode 1B: Multipart upload with 'file' field ---
  if (contentType.startsWith("multipart/form-data")) {
    try {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return bad(400, "file_not_found");

      const u8 = new Uint8Array(await file.arrayBuffer());
      const result = await verifySignedBundle(u8);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[proofs.verify.bundle_multipart.error]", String(e?.message || e));
      return bad(500, "bundle_verify_failed", { detail: String(e?.message || e) });
    }
  }

  // --- Mode 2: Legacy JSON { id } verification ---
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return bad(500, "supabase_env_missing");
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const id = (body?.id || "").toString().trim();
  if (!id) return bad(400, "provide_id_or_upload_bundle");

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data, error } = await sb
    .from("proof_ledger")
    .select("id, root_hex, algorithm, key_id, signature_b64")
    .eq("id", id)
    .single();

  if (error || !data) return bad(404, "record_not_found");

  try {
    const verified = await verifyLedgerRecord(data as any);
    return NextResponse.json({ ok: true, id: data.id, verified }, { status: 200 });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[proofs.verify.ledger.error]", String(e?.message || e));
    return bad(500, "ledger_verify_failed", { id: data.id, detail: String(e?.message || e) });
  }
}
