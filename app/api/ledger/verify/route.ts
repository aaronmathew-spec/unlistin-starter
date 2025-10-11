/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { beat } from "@/lib/ops/heartbeat";
import { verifySignature } from "@/lib/ledger";

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
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

/**
 * GET /api/ledger/verify?id=123
 *  or /api/ledger/verify?hash=...&sig=...
 *
 * Returns: { ok: boolean, verified: boolean, method: "db"|"query", hash?: string }
 */
export async function GET(req: Request) {
  await beat("ledger.verify:get");

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    const hash = url.searchParams.get("hash")?.trim();
    const sig = url.searchParams.get("sig")?.trim();

    // Path A: raw pair present (does not hit DB)
    if (hash && sig) {
      const verified = verifySignature(hash, sig);
      return NextResponse.json({ ok: true, verified, method: "query", hash });
    }

    // Path B: verify by action id
    if (!id) {
      return json({ ok: false, error: "missing-id-or-hash-sig" }, { status: 400 });
    }

    const db = supa();
    const { data, error } = await db
      .from("actions")
      .select("id, proof_hash, proof_sig")
      .eq("id", id)
      .maybeSingle();

    if (error) return json({ ok: false, error: error.message }, { status: 400 });
    if (!data) return json({ ok: false, error: "not-found" }, { status: 404 });
    if (!data.proof_hash || !data.proof_sig) {
      return json({ ok: false, error: "no-proof-for-action" }, { status: 404 });
    }

    const verified = verifySignature(data.proof_hash, data.proof_sig);
    return NextResponse.json({ ok: true, verified, method: "db", hash: data.proof_hash });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || "unexpected-error" }, { status: 500 });
  }
}
