// app/ops/proofs/export/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyLedgerRecord } from "@/lib/crypto/verify";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

function bad(status: number, msg: string) {
  return new NextResponse(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function toCsvValue(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Quote if contains comma, quote or newline
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return bad(500, "supabase_env_missing");
  }

  const url = new URL(req.url);
  const limRaw = url.searchParams.get("limit");
  let limit = Number.isFinite(Number(limRaw)) ? Number(limRaw) : 200;
  if (!Number.isFinite(limit)) limit = 200;
  if (limit <= 0) limit = 200;
  if (limit > 1000) limit = 1000;

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data, error } = await sb
    .from("proof_ledger")
    .select(
      "id, created_at, root_hex, algorithm, key_id, signature_b64, pack_id, subject_id, controller_key"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return bad(500, error.message);
  const rows = (data || []) as any[];

  // Verify each row (ok/error/false).
  const enriched = [];
  for (const r of rows) {
    let verified: boolean | "error" = "error";
    try {
      verified = await verifyLedgerRecord({
        id: r.id,
        root_hex: r.root_hex,
        algorithm: r.algorithm,
        key_id: r.key_id,
        signature_b64: r.signature_b64,
      } as any);
    } catch {
      verified = "error";
    }
    enriched.push({ ...r, verified });
  }

  const header = [
    "id",
    "created_at",
    "algorithm",
    "key_id",
    "root_hex",
    "verified",
    "pack_id",
    "subject_id",
    "controller_key",
  ];

  const lines = [header.join(",")];
  for (const r of enriched) {
    lines.push(
      [
        toCsvValue(r.id),
        toCsvValue(r.created_at),
        toCsvValue(r.algorithm ?? ""),
        toCsvValue(r.key_id ?? ""),
        toCsvValue(r.root_hex ?? ""),
        toCsvValue(
          r.verified === true ? "valid" : r.verified === false ? "invalid" : "error"
        ),
        toCsvValue(r.pack_id ?? ""),
        toCsvValue(r.subject_id ?? ""),
        toCsvValue(r.controller_key ?? ""),
      ].join(",")
    );
  }

  const csv = lines.join("\n");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="unlistin-proof-ledger-${ts}.csv"`,
    },
  });
}
