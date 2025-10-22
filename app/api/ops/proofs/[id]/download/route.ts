// app/api/ops/proofs/[id]/download/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyLedgerRecord } from "@/lib/crypto/verify";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return bad(500, "supabase_env_missing");
  }

  const id = (ctx.params?.id || "").toString().trim();
  if (!id) return bad(400, "missing_id");

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data, error } = await sb
    .from("proof_ledger")
    .select(
      "id, created_at, root_hex, algorithm, key_id, signature_b64, pack_id, subject_id, controller_key"
    )
    .eq("id", id)
    .single();

  if (error || !data) return bad(404, "not_found");

  let verified: boolean | "error" = "error";
  try {
    verified = await verifyLedgerRecord({
      id: data.id,
      root_hex: data.root_hex,
      algorithm: data.algorithm,
      key_id: data.key_id,
      signature_b64: data.signature_b64,
    } as any);
  } catch {
    verified = "error";
  }

  const payload = {
    ok: true,
    record: data,
    verified,
    exported_at: new Date().toISOString(),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="unlistin-proof-${id}.json"`,
    },
  });
}
