// src/app/api/proofs/commit/route.ts
import { buildMerkleRoot, signRoot } from "@/lib/proofs/merkle";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, svc);

export async function POST(req: Request) {
  const { subjectId, evidenceHashes } = await req.json();
  if (!subjectId || !Array.isArray(evidenceHashes) || evidenceHashes.length === 0) {
    return new Response(JSON.stringify({ error: "subjectId and evidenceHashes[] required" }), { status: 400 });
  }

  const { rootHex } = buildMerkleRoot(evidenceHashes);
  const signature = await signRoot(rootHex);

  const { data, error } = await supabase.from("proof_ledger").insert({
    subject_id: subjectId,
    merkle_root: rootHex,
    hsm_signature: signature,
    evidence_count: evidenceHashes.length,
  }).select("*").single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ proof: data }), { status: 200 });
}
