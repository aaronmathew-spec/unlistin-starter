// src/app/api/proofs/commit/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { buildMerkleRoot, signRoot } from "@/lib/proofs/merkle";

// Supabase (service role preferred; falls back to anon if needed)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Accept either evidenceHashes[] or evidenceTexts[]
const InputSchema = z.object({
  subjectId: z.string().uuid(),
  evidenceHashes: z.array(z.string()).min(1).optional(),
  evidenceTexts: z.array(z.string()).min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InputSchema.parse(body);

    // Normalize to a single string array
    const rawList = parsed.evidenceHashes ?? parsed.evidenceTexts ?? [];
    if (!rawList.length) {
      return NextResponse.json(
        { error: "Provide evidenceHashes[] or evidenceTexts[] (non-empty)" },
        { status: 400 }
      );
    }

    // Deduplicate & basic sanitation (trim)
    const evidence = Array.from(new Set(rawList.map((s) => (s ?? "").toString().trim()))).filter(
      (s) => s.length > 0
    );
    if (evidence.length === 0) {
      return NextResponse.json({ error: "No usable evidence strings provided" }, { status: 400 });
    }

    // Build Merkle root (your helper returns { rootHex })
    const { rootHex } = buildMerkleRoot(evidence);

    // Sign the root (your helper handles KMS/Ed25519/etc. as implemented)
    const signature = await signRoot(rootHex);

    // Persist to proof_ledger
    const { data, error } = await supabase
      .from("proof_ledger")
      .insert({
        subject_id: parsed.subjectId,
        merkle_root: rootHex,
        hsm_signature: signature,
        evidence_count: evidence.length,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[proofs/commit] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ proof: data }, { status: 200 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: err.errors },
        { status: 400 }
      );
    }
    console.error("[proofs/commit] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
