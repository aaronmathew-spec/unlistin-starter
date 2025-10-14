// src/app/proof/[subjectId]/page.tsx
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

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
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proof Vault</h1>
          <p className="text-sm text-neutral-500">Subject: {params.subjectId}</p>
        </div>
        <a
          href={`/api/proofs/pack?subjectId=${params.subjectId}`}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="opacity-70">
            <path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v8.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4.0 4a1 1 0 0 1-1.414 0l-4.0-4a1 1 0 0 1 1.414-1.414L11 12.586V4a1 1 0 0 1 1-1Zm-7 13a1 1 0 0 1 1 1v2h12v-2a1 1 0 1 1 2 0v3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"/>
          </svg>
          Download Proof Pack
        </a>
      </header>

      <div className="mt-2 grid gap-4">
        {proofs?.map((p) => (
          <div key={p.id} className="rounded-2xl border p-4">
            <div className="text-sm">Merkle Root</div>
            <div className="font-mono break-all">{p.merkle_root}</div>
            <div className="mt-2 text-sm">Signature</div>
            <div className="font-mono break-all">{p.hsm_signature ?? "—"}</div>
            <div className="mt-2 text-sm">Artifacts</div>
            <div>{p.evidence_count ?? 0}</div>
            {p.arweave_tx_id && (
              <div className="mt-2 text-sm break-all">
                Anchor: <span className="font-mono">{p.arweave_tx_id}</span>
              </div>
            )}
            <div className="mt-2 text-xs text-neutral-500">
              Committed: {new Date(p.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        {(!proofs || proofs.length === 0) && (
          <div className="text-sm text-neutral-500">No proofs yet.</div>
        )}
      </div>

      <div className="pt-2 text-xs text-neutral-500">
        Proof Pack bundles a signed manifest, HTML report, and verification artifact hashes in a ZIP.
      </div>
    </div>
  );
}
