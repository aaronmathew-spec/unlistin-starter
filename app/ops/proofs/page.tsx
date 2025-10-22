// app/ops/proofs/page.tsx
import { createClient } from "@supabase/supabase-js";
import { verifyLedgerRecord } from "@/lib/crypto/verify";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

type ProofRow = {
  id: string;
  created_at: string;
  root_hex: string | null;
  algorithm: string | null;
  key_id: string | null;
  signature_b64: string | null;
  pack_id: string | null;
  subject_id: string | null;
  controller_key: string | null;
};

type EnrichedRow = ProofRow & { verified: boolean | "error" };

async function fetchLatest(): Promise<ProofRow[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase environment variables are missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE).");
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data, error } = await sb
    .from("proof_ledger")
    .select(
      "id, created_at, root_hex, algorithm, key_id, signature_b64, pack_id, subject_id, controller_key"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []) as ProofRow[];
}

export default async function OpsProofsPage() {
  // TODO: add your admin guard (middleware or layout) if needed
  const rows = await fetchLatest();

  const enriched: EnrichedRow[] = await Promise.all(
    rows.map(async (r) => {
      let verified: boolean | "error" = "error";
      try {
        verified = await verifyLedgerRecord({
          id: r.id,
          root_hex: r.root_hex,
          algorithm: r.algorithm,
          key_id: r.key_id,
          signature_b64: r.signature_b64,
        } as any);
      } catch {
        verified = "error";
      }
      return { ...r, verified };
    })
  );

  return (
    <div className="container" style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1 className="h1" style={{ margin: 0 }}>
            Ops · Proof Ledger
          </h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Latest signed Merkle roots with live verification.
          </p>
        </div>
        <a
          href="/ops/proofs/export"
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ⬇️ Download CSV
        </a>
      </div>

      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table
          className="table"
          style={{ width: "100%", borderCollapse: "collapse" }}
        >
          <thead>
            <tr>
              <th>ID</th>
              <th>Created</th>
              <th>Algorithm</th>
              <th>Key ID</th>
              <th>Root (hex, short)</th>
              <th>Verified</th>
              <th>Pack</th>
              <th>Subject</th>
              <th>Controller</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((r) => {
              const created =
                r.created_at ? new Date(r.created_at).toLocaleString() : "—";
              const keyId = r.key_id || "—";
              const algo = r.algorithm || "—";
              const rootShort =
                r.root_hex && r.root_hex.length >= 24
                  ? `${r.root_hex.slice(0, 16)}…${r.root_hex.slice(-8)}`
                  : r.root_hex || "—";
              const verifiedColor =
                r.verified === true
                  ? "green"
                  : r.verified === false
                  ? "red"
                  : "#995f00";

              return (
                <tr key={r.id}>
                  <td style={{ fontFamily: "monospace" }}>{r.id}</td>
                  <td>{created}</td>
                  <td>{algo}</td>
                  <td
                    style={{
                      maxWidth: 280,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={keyId}
                  >
                    {keyId}
                  </td>
                  <td style={{ fontFamily: "monospace" }}>{rootShort}</td>
                  <td style={{ fontWeight: 600, color: verifiedColor }}>
                    {r.verified === true
                      ? "✓ valid"
                      : r.verified === false
                      ? "✗ invalid"
                      : "error"}
                  </td>
                  <td>{r.pack_id || "—"}</td>
                  <td>{r.subject_id || "—"}</td>
                  <td>{r.controller_key || "—"}</td>
                  <td>
                    <a
                      href={`/api/ops/proofs/${encodeURIComponent(
                        r.id
                      )}/download`}
                      style={{ textDecoration: "none" }}
                    >
                      Download JSON
                    </a>
                  </td>
                </tr>
              );
            })}
            {!enriched.length && (
              <tr>
                <td
                  colSpan={10}
                  style={{ padding: 24, textAlign: "center", color: "#666" }}
                >
                  No proofs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "#fcfdfd",
          fontSize: 13,
          color: "#6b7280",
        }}
      >
        Tip: You can export a KMS-signed bundle from{" "}
        <a href="/ops/proofs">/ops/proofs</a> (Export & Verify UI) if you’ve
        enabled Proof Vault v2.
      </div>
    </div>
  );
}
