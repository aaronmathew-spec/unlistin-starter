// app/api/ops/proofs/[id]/download/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function srv() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  const id = (params?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const sb = srv();
  const { data, error } = await sb
    .from("proof_ledger")
    .select("id,created_at,root_hex,algorithm,key_id,signature_b64,pack_id,subject_id,controller_key,metadata")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return new NextResponse(JSON.stringify({ ok: true, record: data }, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="proof_${id}.json"`,
      "cache-control": "no-store",
    },
  });
}
