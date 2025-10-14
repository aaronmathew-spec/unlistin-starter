// src/app/proof/[subjectId]/pack/page.tsx
"use client";

import { useState } from "react";

export default function ProofPackPage({ params }: { params: { subjectId: string } }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const download = async () => {
    setErr(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ subjectId: params.subjectId });
      const res = await fetch(`/api/proofs/pack?${qs.toString()}`, { method: "GET" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `unlistin-proof-pack-${params.subjectId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.message || "Download failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Proof Pack</h1>
      <p className="text-sm text-gray-600">Subject: {params.subjectId}</p>
      <button
        onClick={download}
        disabled={loading}
        className="px-4 py-2 rounded-xl border shadow-sm hover:bg-gray-50 disabled:opacity-60"
      >
        {loading ? "Preparing…" : "Download ZIP"}
      </button>
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <p className="text-xs text-gray-500">
        The ZIP includes a signed manifest (JSON) and a human-readable HTML report (Merkle root, signature, evidence hashes).
      </p>
    </div>
  );
}
