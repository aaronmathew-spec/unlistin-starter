// app/api/ledger/verify/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { verifySignature, sha256Hex } from "@/lib/ledger";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

/**
 * GET /api/ledger/verify?id=<actionId>
 * Public verifier: returns { ok, valid, hash }
 *
 * It recomputes the expected hash from stored, PII-redacted columns and
 * constant-time verifies HMAC signature. We don't reveal drafts/body here.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ ok: false, error: "Missing id" }, { status: 400 });

  const db = supa();
  const { data: row, error } = await db
    .from("actions_public_view")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return json({ ok: false, error: error.message }, { status: 400 });
  if (!row) return json({ ok: false, error: "Not found" }, { status: 404 });

  // Recompute hash payload
  const envelope = {
    id: row.id,
    broker: row.broker,
    category: row.category,
    redacted_identity: row.redacted_identity || {},
    evidence_urls: Array.isArray(row.evidence) ? row.evidence.map((e: any) => e.url) : [],
    draft_subject_hash: row.draft_subject ? sha256Hex(row.draft_subject) : undefined,
    timestamp: row.created_at,
  };
  const payload = JSON.stringify(envelope);
  const hash = sha256Hex(payload);

  const valid = !!row.proof_sig && verifySignature(hash, row.proof_sig);
  return NextResponse.json({ ok: true, valid, hash });
}
