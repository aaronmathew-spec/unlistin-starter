// app/ops/proofs/export/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// NOTE: We assume your /ops/* area is admin-gated elsewhere (middleware/layout).
// This route runs server-side with service role (no client secrets exposed).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function srv() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes("\n") || s.includes("\"")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new NextResponse("Supabase env missing", { status: 500 });
  }

  const sb = srv();
  const { data, error } = await sb
    .from("proof_ledger")
    .select("id,created_at,root_hex,algorithm,key_id,signature_b64,pack_id,subject_id,controller_key,metadata")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return new NextResponse(`query_error,${csvEscape(error.message)}`, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const rows = data ?? [];
  const headers = [
    "id",
    "created_at",
    "algorithm",
    "key_id",
    "root_hex",
    "signature_b64",
    "pack_id",
    "subject_id",
    "controller_key",
    "metadata_json",
  ];

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      csvEscape(r.id),
      csvEscape(r.created_at),
      csvEscape(r.algorithm),
      csvEscape(r.key_id),
      csvEscape(r.root_hex),
      csvEscape(r.signature_b64),
      csvEscape(r.pack_id),
      csvEscape(r.subject_id),
      csvEscape(r.controller_key),
      csvEscape(r.metadata ? JSON.stringify(r.metadata) : ""),
    ].join(","));
  }

  const body = lines.join("\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="proof_ledger_latest.csv"`,
      "cache-control": "no-store",
    },
  });
}
