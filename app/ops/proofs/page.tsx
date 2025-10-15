// app/ops/proofs/page.tsx
import { createClient } from "@supabase/supabase-js";
import { verifyLedgerRecord } from "@/lib/crypto/verify";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

async function fetchLatest() {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("proof_ledger")
    .select("id, created_at, root_hex, algorithm, key_id, signature_b64, pack_id, subject_id, controller_key")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as any[];
}

export default async function OpsProofsPage() {
  // TODO: add your admin guard (middleware or layout)
  const rows = await fetchLatest();

  const enriched = await Promise.all(
    rows.map(async (r) => {
      let verified: boolean | "error" = "error";
      try {
        verified = await verifyLedgerRecord({
          id: r.id,
          root_hex: r.root_hex,
          algorithm: r.algorithm,
          key_id: r.key_id,
          signature_b64: r.signature_b64,
        });
      } catch {
        verified = "error";
      }
      return { ...r, verified };
    })
  );

  return (
    <div className="container" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between" }}>
        <div>
          <h1 className="h1">Ops · Proof Ledger</h1>
          <p className="muted">Latest signed Merkle roots with live verification.</p>
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
        <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
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
            {enriched.map((r) => (
              <tr key={r.id}>
                <td style={{ fontFamily: "monospace" }}>{r.id}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.algorithm}</td>
                <td style={{ maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.key_id}</td>
                <td style={{ fontFamily: "monospace" }}>
                  {r.root_hex?.slice(0, 16)}…{r.root_hex?.slice(-8)}
                </td>
                <td style={{ fontWeight: 600, color: r.verified === true ? "green" : r.verified === false ? "red" : "#995f00" }}>
                  {r.verified === true ? "✓ valid" : r.verified === false ? "✗ invalid" : "error"}
                </td>
                <td>{r.pack_id || "—"}</td>
                <td>{r.subject_id || "—"}</td>
                <td>{r.controller_key || "—"}</td>
                <td>
                  <a
                    href={`/api/ops/proofs/${encodeURIComponent(r.id)}/download`}
                    style={{ textDecoration: "none" }}
                  >
                    Download JSON
                  </a>
                </td>
              </tr>
            ))}
            {!enriched.length && (
              <tr>
                <td colSpan={10} style={{ padding: 24, textAlign: "center", color: "#666" }}>
                  No proofs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
