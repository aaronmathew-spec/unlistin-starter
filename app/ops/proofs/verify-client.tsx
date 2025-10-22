// app/ops/proofs/verify-client.tsx
"use client";

import * as React from "react";

type VerifyResp = {
  ok: boolean;
  reason?: string;
  manifest?: {
    schema: string;
    subjectId: string;
    createdAt: string;
    signer: { backend: string; keyId: string; alg: "ed25519" | "rsa-pss-sha256" };
    assets: { filename: string; sha256: string; size: number };
    meta?: Record<string, any>;
  };
  recomputedSha256?: string;
};

export default function VerifyClient() {
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState<VerifyResp | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || !files[0]) return;
    setBusy(true);
    setErr(null);
    setRes(null);

    try {
      const fd = new FormData();
      fd.append("file", files[0]);

      const r = await fetch("/api/proofs/verify", {
        method: "POST",
        body: fd,
      });

      const json: VerifyResp = await r.json();
      setRes(json);
      if (!json.ok) setErr(json.reason || "verification_failed");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer?.files || null);
  }

  function onPick() {
    inputRef.current?.click();
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.currentTarget.files)}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={onDrop}
        onClick={onPick}
        style={{
          border: "2px dashed #d1d5db",
          borderRadius: 12,
          padding: 24,
          background: "#fafafa",
          textAlign: "center",
          cursor: "pointer",
        }}
        aria-disabled={busy}
      >
        {busy ? "Verifying…" : "Click to choose or drop a bundle .zip here"}
      </div>

      {err ? (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            padding: 12,
            borderRadius: 10,
          }}
        >
          <b>Verification failed:</b> {err}
        </div>
      ) : null}

      {res ? (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#111827",
            padding: 12,
            borderRadius: 10,
          }}
        >
          <div>
            <b>OK:</b> {res.ok ? "true" : "false"}
          </div>
          {res.manifest ? (
            <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 13 }}>
              <div>schema: {res.manifest.schema}</div>
              <div>subjectId: {res.manifest.subjectId}</div>
              <div>createdAt: {res.manifest.createdAt}</div>
              <div>
                signer: {res.manifest.signer.alg} · {res.manifest.signer.backend} ·{" "}
                {res.manifest.signer.keyId}
              </div>
              <div>
                assets.pack.zip: sha256={res.manifest.assets.sha256} · size=
                {res.manifest.assets.size}
              </div>
              {res.recomputedSha256 ? (
                <div>recomputedSha256: {res.recomputedSha256}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
