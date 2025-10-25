// app/ops/authorizations/page.tsx
/* Server-only list of recent authorizations */
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  subject_full_name: string;
  subject_email: string | null;
  subject_phone: string | null;
  region: string | null;
  signer_name: string;
  signed_at: string;
  manifest_hash: string | null;
  created_at: string;
};

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function mono(v: string) {
  return (
    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
      {v}
    </span>
  );
}

export default async function Page() {
  let rows: Row[] = [];
  try {
    const supa = admin();
    const { data } = await supa
      .from("authorizations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (data ?? []) as Row[];
  } catch {
    rows = [];
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Authorizations</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Signed LoA/KYC artifacts reference. Uses service-role (server-only).
          </p>
        </div>
        <a
          href="/ops"
          style={{
            textDecoration: "none",
            border: "1px solid #e5e7eb",
            padding: "8px 12px",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          ← Ops Home
        </a>
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          background: "white",
        }}
      >
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid #e5e7eb",
            background: "#f9fafb",
            fontWeight: 600,
          }}
        >
          Recent (max 100)
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: 900,
              borderCollapse: "separate",
              borderSpacing: 0,
            }}
          >
            <thead style={{ textAlign: "left", background: "#fafafa" }}>
              <tr>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>ID</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Subject</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Email / Phone</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Region</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Signer</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Signed At</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Hash</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>{mono(r.id.slice(0, 8))}</td>
                    <td style={{ padding: 12 }}>{r.subject_full_name}</td>
                    <td style={{ padding: 12 }}>
                      {(r.subject_email ?? "—")}/{(r.subject_phone ?? "—")}
                    </td>
                    <td style={{ padding: 12 }}>{r.region ?? "—"}</td>
                    <td style={{ padding: 12 }}>{r.signer_name}</td>
                    <td style={{ padding: 12 }}>{new Date(r.signed_at).toLocaleString()}</td>
                    <td style={{ padding: 12 }}>{mono((r.manifest_hash || "").slice(0, 12))}</td>
                    <td style={{ padding: 12 }}>
                      <a href={`/ops/authorizations/${r.id}`} style={{ textDecoration: "none" }}>
                        View →
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                    No authorizations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
