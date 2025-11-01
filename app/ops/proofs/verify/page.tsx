// app/ops/proofs/verify/page.tsx
"use client";

import * as React from "react";

/** ---------- types (kept compatible) ---------- */
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

/** ---------- small UI helpers ---------- */
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
      {props.desc ? <p style={{ marginTop: 4, color: "#6b7280" }}>{props.desc}</p> : null}
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

/** ---------- page ---------- */
export default function OpsVerifyPage() {
  // Bundle verify state
  const [zipFile, setZipFile] = React.useState<File | null>(null);
  const [bundleRes, setBundleRes] = React.useState<VerifyBundleResult | null>(null);
  const [bundleErr, setBundleErr] = React.useState<string | null>(null);
  const [bundleLoading, setBundleLoading] = React.useState(false);

  // Verify-by-id state
  const [recordId, setRecordId] = React.useState("");
  const [idRes, setIdRes] = React.useState<VerifyByIdResult | null>(null);
  const [idErr, setIdErr] = React.useState<string | null>(null);
  const [idLoading, setIdLoading] = React.useState(false);

  // Endpoint path (compatible with current API; adjust here if you move it later)
  const VERIFY_API = "/api/proofs/verify";

  async function safeJson(res: Response) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

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
      const resp = await fetch(VERIFY_API, { method: "POST", body: fd });
      const json = (await safeJson(resp)) as VerifyBundleResult | null;

      if (!resp.ok) {
        const message =
          (json as any)?.error ||
          (resp.status === 404
            ? "Verify API not found. Deploy the /api/proofs/verify route."
            : `HTTP ${resp.status}`);
        setBundleErr(message);
        setBundleRes(json ?? { ok: false, error: message });
        return;
      }

      setBundleRes(json ?? { ok: true });
      if (!json?.ok) setBundleErr((json as any)?.error || "Verification failed");
    } catch (e: any) {
      setBundleErr(String(e?.message || e || "verification_failed"));
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
      const resp = await fetch(VERIFY_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: trimmed }),
      });
      const json = (await safeJson(resp)) as VerifyByIdResult | null;

      if (!resp.ok) {
        const message =
          (json as any)?.error ||
          (resp.status === 404
            ? "Verify API not found. Deploy the /api/proofs/verify route."
            : `HTTP ${resp.status}`);
        setIdErr(message);
        setIdRes(json ?? { ok: false, error: message });
        return;
      }

      setIdRes(json ?? { ok: true, verified: true, id: trimmed });
      if (!json?.ok) setIdErr(json?.error || "Verification failed");
    } catch (e: any) {
      setIdErr(String(e?.message || e || "verification_failed"));
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
        desc="Drag & drop the bundle exported by Proof Vault. We’ll check the manifest hash and signature (KMS/Ed25519)."
      >
        <input
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
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
          <li>
            <a href="/verify">Public Verify (customer-facing)</a>
          </li>
        </ul>
      </Section>
    </div>
  );
}
