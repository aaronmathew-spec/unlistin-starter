"use client";
import { useState } from "react";

export default function VerifyBundle() {
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File) => {
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await fetch("/api/proofs/verify", { method: "POST", body: fd });
      const json = await res.json();
      setResult({ ok: res.ok, data: json });
    } catch (e: any) {
      setResult({ ok: false, data: { error: String(e?.message || e) } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="font-semibold">Verify Proof Bundle</div>
      <input
        type="file"
        accept=".zip,application/zip"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
        disabled={busy}
      />
      {busy && <div>Verifying…</div>}
      {result && (
        <pre className="text-sm overflow-auto bg-gray-50 p-2 rounded">
{JSON.stringify(result.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
