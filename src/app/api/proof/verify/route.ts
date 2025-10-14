// src/app/api/proof/verify/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { verifyAsync, getPublicKeyAsync } from "@noble/ed25519";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const Input = z.object({
  root: z.string().regex(/^[0-9a-f]+$/i).min(64),
});

function hexToBytes(hex: string) {
  if (hex.length % 2) throw new Error("Invalid hex");
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const root = searchParams.get("root") || "";
    const parsed = Input.safeParse({ root });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid or missing ?root" }, { status: 400 });
    }

    // Lookup the proof_ledger entry
    const { data: row, error } = await db
      .from("proof_ledger")
      .select("id, subject_id, merkle_root, hsm_signature, evidence_count, created_at, arweave_tx_id")
      .eq("merkle_root", parsed.data.root)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) {
      return NextResponse.json({ ok: false, verified: false, reason: "not_found" }, { status: 404 });
    }

    // Verify signature
    const pubHex =
      process.env.PROOF_VERIFY_PUBKEY ||
      (process.env.PROOF_SIGNING_KEY
        ? Buffer.from(await getPublicKeyAsync(Buffer.from(process.env.PROOF_SIGNING_KEY, "hex"))).toString("hex")
        : "");

    if (!pubHex) {
      return NextResponse.json(
        { ok: false, error: "Missing PROOF_VERIFY_PUBKEY (or PROOF_SIGNING_KEY for fallback)" },
        { status: 500 }
      );
    }

    const msg = hexToBytes(row.merkle_root);
    const sig = hexToBytes(row.hsm_signature);
    const pub = hexToBytes(pubHex);

    const verified = await verifyAsync(sig, msg, pub);
    return NextResponse.json({
      ok: true,
      verified,
      proof: {
        id: row.id,
        subjectId: row.subject_id,
        merkleRoot: row.merkle_root,
        signature: row.hsm_signature,
        evidenceCount: row.evidence_count,
        createdAt: row.created_at,
        anchorTxId: row.arweave_tx_id || null,
      },
    });
  } catch (e: any) {
    console.error("[api/proof/verify] error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
