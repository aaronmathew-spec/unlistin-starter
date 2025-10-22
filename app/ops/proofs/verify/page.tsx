// app/ops/proofs/verify/page.tsx
"use client";

import * as React from "react";

type VerifyBundleResult = {
  ok: boolean;
  [k: string]: unknown;
};

type VerifyByIdResult = {
  ok: boolean;
  id?: string;
  verified?: boolean;
  error?: string;
  [k: string]: unknown;
};

function Section(props: React.PropsWithChildren<{ title: string; desc?: string }>) {
  return (
    <section
      style={{
        marginTop: 16,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fff",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{props.title}</h3>
      {props.desc ? (
        <p style={{ marginTop: 4, color: "#6b7280" }}>{props.desc}</p>
      ) : null}
      <div style={{ marginTop: 12 }}>{props.children}</div>
    </section>
  );
}

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }
) {
  const { loading, ...rest } = props;
  return (
    <button
      {...rest}
      disabled={loading || props.disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: loading ? "#6b7280" : "#111827",
        color: "#fff",
        fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer",
      }}
    >
      {loading ? "Working..." : props.children}
    </button>
  );
}

function MonoBox({ children }: { children: React.ReactNode }) {
  return (
    <pre
      style={{
        marginTop: 12,
        padding: 12,
        background: "#0b1020",
        color: "#e5e7eb",
        borderRadius: 8,
        overflowX: "auto",
        fontSize: 12.5,
      }}
    >
      {children}
    </pre>
  );
}

export default function OpsVerifyPage() {
  // --- Bundle verify state ---
  const [zipFile, setZipFile] = React.useState<File | null>(null);
  const [bundleRes, setBundleRes] = React.useState<VerifyBundleResult | null>(null);
  const [bundleErr, setBundleErr] = React.useState<string | null>(null);
  const [bundleLoading, setBundleLoading] = React.useState(false);

  // --- Verify-by-id state ---
  const [recordId, setRecordId] = React.useState("");
  const [idRes, setIdRes] = React.useState<VerifyByIdResult | null>(null);
  const [idErr, setIdErr] = React.useState<string | null>(null);
  const [idLoading, setIdLoading] = React.useState(false);

  async function handleBundleVerify() {
    setBundleErr(null);
    setBundleRes(null);
    if (!zipFile) {
      setBundleErr("Please choose a .zip bundle first.");
      return;
    }

    const fd = new FormData();
    fd.append("file", zipFile);

    setBundleLoading(true);
    try {
      const resp = await fetch("/api/proofs/verify", {
        method: "POST",
        body: fd,
      });
      const json = (await resp.json()) as VerifyBundleResult;
      setBundleRes(json);
      if (!resp.ok) {
        setBundleErr((json as any)?.error || `HTTP ${resp.status}`);
      }
    } catch (e: any) {
      setBundleErr(String(e?.message || e));
    } finally {
      setBundleLoading(false);
    }
  }

  async function handleIdVerify() {
    setIdErr(null);
    setIdRes(null);
    const trimmed = recordId.trim();
    if (!trimmed) {
      setIdErr("Enter a proof_ledger ID to verify.");
      return;
    }
    setIdLoading(true);
    try {
      const resp = await fetch("/api/proofs/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: trimmed }),
      });
      const json = (await resp.json()) as VerifyByIdResult;
      setIdRes(json);
      if (!resp.ok) {
        setIdErr(json?.error || `HTTP ${resp.status}`);
      }
    } catch (e: any) {
      setIdErr(String(e?.message || e));
    } finally {
      setIdLoading(false);
    }
  }

  return (
    <div className="container" style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <header
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Ops · Proof Verify</h1>
          <div style={{ color: "#6b7280", marginTop: 4 }}>
            Upload a signed bundle or verify a single ledger record by ID.
          </div>
        </div>
      </header>

      <Section
        title="Verify Signed Bundle (.zip)"
        desc="Drag & drop the bundle exported by Proof Vault v2. We’ll check the manifest hash and the signature (KMS or Ed25519)."
      >
        <input
          type="file"
          accept=".zip,application/zip"
          onChange={(e) => setZipFile(e.target.files?.[0] || null)}
          style={{ display: "block", marginBottom: 12 }}
        />
        <Button onClick={handleBundleVerify} loading={bundleLoading}>
          Verify Bundle
        </Button>

        {bundleErr ? (
          <div style={{ color: "#b91c1c", marginTop: 12 }}>Error: {bundleErr}</div>
        ) : null}
        {bundleRes ? <MonoBox>{JSON.stringify(bundleRes, null, 2)}</MonoBox> : null}
      </Section>

      <Section
        title="Verify by Ledger ID"
        desc="Back-compat: we fetch the row from Supabase and verify its fields."
      >
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={recordId}
            onChange={(e) => setRecordId(e.target.value)}
            placeholder="proof_ledger.id"
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              outline: "none",
              minWidth: 280,
            }}
          />
          <Button onClick={handleIdVerify} loading={idLoading}>
            Verify ID
          </Button>
        </div>

        {idErr ? <div style={{ color: "#b91c1c", marginTop: 12 }}>Error: {idErr}</div> : null}
        {idRes ? <MonoBox>{JSON.stringify(idRes, null, 2)}</MonoBox> : null}
      </Section>

      <Section title="Quick Links">
        <ul style={{ margin: "8px 0 0 16px" }}>
          <li>
            <a href="/ops/proofs">Ledger Table</a>
          </li>
          <li>
            <a href="/ops/proofs/export">Export CSV</a>
          </li>
        </ul>
      </Section>
    </div>
  );
}
