// src/app/proof/[subjectId]/page.tsx
import { createClient } from "@supabase/supabase-js";

export default async function ProofPage({ params }: { params: { subjectId: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: proofs, error } = await supabase
    .from("proof_ledger")
    .select("*")
    .eq("subject_id", params.subjectId)
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-6 text-red-600">Error: {error.message}</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Proof Vault</h1>
      <p className="text-sm text-neutral-500">Subject: {params.subjectId}</p>
      <div className="mt-4 grid gap-4">
        {proofs?.map((p) => (
          <div key={p.id} className="rounded-2xl border p-4">
            <div className="text-sm">Merkle Root</div>
            <div className="font-mono break-all">{p.merkle_root}</div>
            <div className="mt-2 text-sm">Signature</div>
            <div className="font-mono break-all">{p.hsm_signature}</div>
            <div className="mt-2 text-sm">Artifacts</div>
            <div>{p.evidence_count}</div>
            {p.arweave_tx_id && (
              <div className="text-sm">Anchor: {p.arweave_tx_id}</div>
            )}
          </div>
        ))}
        {(!proofs || proofs.length === 0) && (
          <div className="text-sm text-neutral-500">No proofs yet.</div>
        )}
      </div>
    </div>
  );
}
