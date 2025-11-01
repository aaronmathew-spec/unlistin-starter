// app/verify/page.tsx
"use client";

import { useState } from "react";

type VerifyResp =
  | { ok: true; details?: unknown }
  | { ok: false; error?: string };

export default function VerifyPage() {
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<VerifyResp | null>(null);

  async function onVerify() {
    setLoading(true);
    setOut(null);
    try {
      // Try your public verification endpoint (if present).
      // Gracefully handle 404/501 if not wired yet.
      const res = await fetch("/api/ops/proofs/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref: ref.trim() }),
      });

      let json: VerifyResp;
      try {
        json = (await res.json()) as VerifyResp;
      } catch {
        json = { ok: false, error: `HTTP ${res.status}` };
      }

      if (!res.ok || !json.ok) {
        setOut({ ok: false, error: (json as any)?.error || `HTTP ${res.status}` });
      } else {
        setOut(json);
      }
    } catch (e: any) {
      setOut({ ok: false, error: e?.message || "verification_failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Verify Proof Bundle</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Paste a <b>Bundle URL</b>, <b>Manifest URL</b>, or <b>Bundle ID</b>. We’ll verify signatures,
        timestamps, and integrity. (No data is stored.)
      </p>

      <div className="mt-5 rounded-2xl border bg-card p-6 shadow-sm">
        <label className="block">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Proof / Manifest / ID</div>
          <input
            className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="e.g., https://…/proofs/manifest.json or UNLSTN-…"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        </label>

        <div className="mt-4">
          <button
            onClick={onVerify}
            disabled={!ref.trim() || loading}
            aria-disabled={!ref.trim() || loading}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </div>

        {/* Output */}
        {!out ? null : out.ok ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-medium">Valid</div>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded bg-white/60 p-2">
              {JSON.stringify(out.details ?? { note: "Proof verified" }, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Verification failed{out.error ? `: ${out.error}` : "."}
          </div>
        )}

        <div className="mt-4 text-xs text-muted-foreground">
          Tip: If your bundle is local, upload the manifest to a temporary URL (e.g., object storage)
          and paste that URL here, or expose the bundle ID returned by our APIs.
        </div>
      </div>
    </div>
  );
}
