// app/api/proofs/verify/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyLedgerRecord } from "@/lib/crypto/verify";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/**
 * POST /api/proofs/verify
 * Body:
 *  { id: string }   // proof_ledger.id
 *
 * Returns: { ok: true, id, verified: boolean }
 */
export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return bad(500, "Supabase env missing");

  const body = (await req.json().catch(() => ({}))) as any;
  const id = (body?.id || "").toString().trim();
  if (!id) return bad(400, "Provide id");

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("proof_ledger")
    .select("id, root_hex, algorithm, key_id, signature_b64")
    .eq("id", id)
    .single();

  if (error || !data) return bad(404, "record_not_found");

  const verified = await verifyLedgerRecord(data as any);

  return NextResponse.json({ ok: true, id: data.id, verified });
}
