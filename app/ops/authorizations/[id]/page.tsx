// app/ops/authorizations/[id]/page.tsx
import { getAuthorization } from "@/src/lib/authz/store";
import { buildAuthorizationManifest } from "@/src/lib/authz/manifest";

export const dynamic = "force-dynamic";

function mono(v: string) {
  return (
    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{v}</span>
  );
}

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = params;
  const got = await getAuthorization(id);

  if (!got.record) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Authorization</h1>
        <p style={{ color: "#6b7280" }}>Not found.</p>
      </div>
    );
  }

  const manifest = buildAuthorizationManifest({
    record: got.record,
    files: got.files,
  });

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
        <div style={{ marginTop: 2 }}>{mono(got.record.id)}</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Subject</div>
            <div style={{ marginTop: 2 }}>
              {got.record.subject_full_name} · {(got.record.subject_email ?? "—")} /{" "}
              {(got.record.subject_phone ?? "—")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Region</div>
            <div style={{ marginTop: 2 }}>{got.record.region ?? "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Signer</div>
            <div style={{ marginTop: 2 }}>{got.record.signer_name}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Signed At</div>
            <div style={{ marginTop: 2 }}>{new Date(got.record.signed_at).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Content Hash</div>
            <div style={{ marginTop: 2 }}>{mono(got.record.manifest_hash || "")}</div>
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
        {got.files.length ? (
          <ul style={{ marginTop: 4 }}>
            {got.files.map((f) => (
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
