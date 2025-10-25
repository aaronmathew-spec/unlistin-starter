// app/ops/authorizations/[id]/page.tsx
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Authorization = {
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

type EvidenceFile = {
  id: string;
  authorization_id: string;
  path: string;
  mime: string;
  bytes: number;
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

export default async function Page({ params }: { params: { id: string } }) {
  const id = params.id;

  const supa = admin();
  const [{ data: authRow }, { data: files }] = await Promise.all([
    supa.from("authorizations").select("*").eq("id", id).maybeSingle<Authorization>(),
    supa.from("authorization_files").select("*").eq("authorization_id", id).order("created_at", { ascending: false }),
  ]);

  if (!authRow) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Authorization</h1>
        <p style={{ color: "#6b7280" }}>Not found.</p>
      </div>
    );
  }

  // Simple manifest preview (what you’d typically sign/verify)
  const manifest = {
    id: authRow.id,
    subject: {
      name: authRow.subject_full_name,
      email: authRow.subject_email,
      phone: authRow.subject_phone,
      region: authRow.region,
    },
    signer: authRow.signer_name,
    signed_at: authRow.signed_at,
    content_hash: authRow.manifest_hash,
    evidence: (files ?? []).map((f: EvidenceFile) => ({
      path: f.path,
      mime: f.mime,
      bytes: f.bytes,
    })),
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Authorization</h1>
        <a
          href="/ops/authorizations"
          style={{
            textDecoration: "none",
            border: "1px solid #e5e7eb",
            padding: "8px 12px",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          ← Back
        </a>
      </div>

      <div
        style={{
          marginTop: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "white",
          padding: 12,
        }}
      >
        <div style={{ fontSize: 13, color: "#6b7280" }}>ID</div>
        <div style={{ marginTop: 2 }}>{mono(authRow.id)}</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Subject</div>
            <div style={{ marginTop: 2 }}>
              {authRow.subject_full_name} · {(authRow.subject_email ?? "—")} / {(authRow.subject_phone ?? "—")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Region</div>
            <div style={{ marginTop: 2 }}>{authRow.region ?? "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Signer</div>
            <div style={{ marginTop: 2 }}>{authRow.signer_name}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Signed At</div>
            <div style={{ marginTop: 2 }}>{new Date(authRow.signed_at).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Content Hash</div>
            <div style={{ marginTop: 2 }}>{mono(authRow.manifest_hash || "")}</div>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "white",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Evidence Files</div>
        {files && files.length ? (
          <ul style={{ marginTop: 4 }}>
            {files.map((f: EvidenceFile) => (
              <li key={f.id}>
                {mono(f.path)} — {f.mime} · {f.bytes} bytes
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: "#6b7280" }}>No files.</div>
        )}
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "white",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Signed Manifest</div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontSize: 12,
            background: "#f9fafb",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
{JSON.stringify(manifest, null, 2)}
        </pre>
      </div>
    </div>
  );
}
