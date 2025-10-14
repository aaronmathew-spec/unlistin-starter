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
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Proof Vault</h1>
          <p className="text-sm text-neutral-500">Subject: {params.subjectId}</p>
        </div>

        {/* Download Proof Pack button (ZIP) */}
        <a
          href={`/api/proofs/pack?subjectId=${params.subjectId}`}
          className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-white hover:bg-neutral-800 active:bg-neutral-900"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 3a1 1 0 0 1 1 1v9.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4.001 4a1 1 0 0 1-1.412 0l-4.001-4a1 1 0 0 1 1.414-1.414L11 13.586V4a1 1 0 0 1 1-1z"></path>
            <path d="M5 20a1 1 0 1 1 0-2h14a1 1 0 1 1 0 2H5z"></path>
          </svg>
          Download Proof Pack (.zip)
        </a>
      </div>

      <div className="grid gap-4">
        {proofs?.map((p) => (
          <div key={p.id} className="rounded-2xl border p-4">
            <div className="text-sm">Merkle Root</div>
            <div className="font-mono break-all">{p.merkle_root}</div>

            <div className="mt-2 text-sm">Signature</div>
            <div className="font-mono break-all">{p.hsm_signature ?? "—"}</div>

            <div className="mt-2 text-sm">Artifacts</div>
            <div>{p.evidence_count ?? 0}</div>

            {p.arweave_tx_id && (
              <div className="mt-2 text-sm">
                Anchor: <span className="font-mono break-all">{p.arweave_tx_id}</span>
              </div>
            )}
            <div className="mt-2 text-sm text-neutral-500">Committed: {p.created_at}</div>
          </div>
        ))}

        {(!proofs || proofs.length === 0) && (
          <div className="text-sm text-neutral-500">No proofs yet.</div>
        )}
      </div>
    </div>
  );
}
