// src/app/proof/verify/page.tsx
"use client";

import { useEffect, useState } from "react";

type VerifyResponse = {
  ok: boolean;
  verified?: boolean;
  proof?: {
    id: string;
    subjectId: string;
    merkleRoot: string;
    signature: string;
    evidenceCount: number;
    createdAt: string;
    anchorTxId: string | null;
  };
  error?: string;
};

export default function VerifyProofPage() {
  const [root, setRoot] = useState("");
  const [res, setRes] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("root");
    if (q) setRoot(q);
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch(`/api/proof/verify?root=${encodeURIComponent(root)}`, { method: "GET" });
      const data = (await r.json()) as VerifyResponse;
      setRes(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Verify Proof</h1>
      <form onSubmit={handleVerify} className="flex gap-2 max-w-3xl">
        <input
          value={root}
          onChange={(e) => setRoot(e.target.value.trim())}
          placeholder="Paste Merkle root hex…"
          className="flex-1 border rounded-xl px-3 py-2 font-mono text-sm"
        />
        <button
          type="submit"
          disabled={loading || !root}
          className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-40"
        >
          {loading ? "Verifying…" : "Verify"}
        </button>
      </form>

      {res && (
        <div className="border rounded-2xl p-4">
          {res.ok ? (
            <>
              <div className="text-sm mb-2">
                Status:{" "}
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    res.verified ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {res.verified ? "Signature valid" : "Signature invalid"}
                </span>
              </div>
              {res.proof && (
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <KV k="Merkle Root" v={<Mono>{res.proof.merkleRoot}</Mono>} />
                  <KV k="Signature" v={<Mono>{res.proof.signature}</Mono>} />
                  <KV k="Evidence Count" v={String(res.proof.evidenceCount)} />
                  <KV k="Created At" v={new Date(res.proof.createdAt).toLocaleString()} />
                  <KV k="Subject" v={<Mono>{res.proof.subjectId}</Mono>} />
                  <KV k="Anchor Tx" v={res.proof.anchorTxId ? <Mono>{res.proof.anchorTxId}</Mono> : "-"} />
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-rose-700">Error: {res.error || "Verification failed"}</div>
          )}
        </div>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-gray-500">{k}</div>
      <div className="text-gray-900 break-all">{v}</div>
    </div>
  );
}
function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-xs break-all">{children}</code>;
}
