// src/app/proof/[subjectId]/page.tsx
import { createClient } from "@supabase/supabase-js";

export default async function ProofPage({ params }: { params: { subjectId: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Server component: safe to use service role here for internal rendering,
  // but we also gracefully fall back to anon if SR key isn't set.
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: proofs, error } = await supabase
    .from("proof_ledger")
    .select("id, subject_id, merkle_root, hsm_signature, evidence_count, arweave_tx_id, created_at")
    .eq("subject_id", params.subjectId)
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-6 text-red-600">Error: {error.message}</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold">Proof Vault</h1>
      <p className="text-sm text-neutral-500">Subject: {params.subjectId}</p>

      <div className="mt-4 grid gap-4">
        {proofs?.map((p: any) => (
          <div key={p.id} className="rounded-2xl border p-4 space-y-2">
            <div className="text-sm font-medium">Merkle Root</div>
            <div className="font-mono break-all text-xs sm:text-sm">{p.merkle_root}</div>

            <div className="text-sm font-medium mt-2">Signature</div>
            <div className="font-mono break-all text-xs sm:text-sm">{p.hsm_signature ?? "—"}</div>

            <div className="text-sm mt-2">Artifacts: {p.evidence_count ?? 0}</div>

            {p.arweave_tx_id ? (
              <div className="text-sm">
                Anchor: <span className="font-mono break-all">{p.arweave_tx_id}</span>
              </div>
            ) : null}

            <div className="text-xs text-neutral-500">
              Created: {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
            </div>
          </div>
        ))}

        {(!proofs || proofs.length === 0) && (
          <div className="text-sm text-neutral-500">No proofs yet.</div>
        )}
      </div>
    </div>
  );
}
