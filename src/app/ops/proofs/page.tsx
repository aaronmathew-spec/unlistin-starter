// src/app/ops/proofs/page.tsx
"use client";

import { useState } from "react";

export default function OpsProofsPage() {
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onExport = async () => {
    setError(null);
    if (!subjectId.trim()) {
      setError("Enter a subjectId");
      return;
    }
    try {
      setBusy(true);
      const url = `/api/proofs/export?subjectId=${encodeURIComponent(subjectId.trim())}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Export failed: ${res.status} ${txt}`);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `unlistin-proof-pack-${subjectId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      setError(e.message || "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Proof Vault Export</h1>
      <p className="text-sm opacity-80">
        Generate a KMS-signed ZIP for a subject’s artifacts from the proof-vault bucket.
      </p>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Subject ID</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="e.g., subj_12345"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        />
      </div>

      <button
        onClick={onExport}
        disabled={busy}
        className="rounded-xl px-4 py-2 border shadow-sm hover:shadow transition"
      >
        {busy ? "Exporting…" : "Export Proof Pack"}
      </button>

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </main>
  );
}
