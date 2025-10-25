// app/ops/authz/[id]/page.tsx
// Server-rendered Authorization viewer (no client JS needed)

import { getAuthorization } from "@/src/lib/authz/store";

export const dynamic = "force-dynamic";

function mono(s: string) {
  return (
    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
      {s}
    </span>
  );
}

// Build a public URL for a file path in the "authz" bucket.
// We assume the bucket is public (as in the intake flow).
function publicUrlFor(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  // Example: https://<proj>.supabase.co/storage/v1/object/public/authz/<path>
  return `${base}/storage/v1/object/public/authz/${path}`;
}

export default async function Page({ params }: { params: { id: string } }) {
  const id = params.id;
  const { record, files } = await getAuthorization(id);

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Authorization</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            View the subject’s authorization, manifest hash, and uploaded evidence.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href="/ops/authz/new"
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            ← New Authorization
          </a>
          <a
            href="/ops/authz/list"
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            List
          </a>
        </div>
      </div>

      {!record ? (
        <div
          style={{
            marginTop: 16,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "white",
            padding: 16,
          }}
        >
          <div style={{ color: "#b91c1c", fontWeight: 700 }}>Not Found</div>
          <div style={{ marginTop: 6, color: "#6b7280" }}>
            No authorization exists with id {mono(id)}.
          </div>
        </div>
      ) : (
        <>
          {/* Top card: subject + manifest */}
          <div
            style={{
              marginTop: 16,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "white",
              padding: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Authorization ID</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>{mono(record.id)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Manifest Hash</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>
                  {record.manifest_hash ? mono(record.manifest_hash) : <span>—</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Subject</div>
                <div style={{ marginTop: 2 }}>
                  {mono(record.subject_full_name)}
                  {record.subject_email ? <> · {mono(record.subject_email)}</> : null}
                  {record.subject_phone ? <> · {mono(record.subject_phone)}</> : null}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Region</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>
                  {record.region ? record.region : "—"}
                </div>
              </div }
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Signer</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>
                  {record.signer_name || "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Signed At</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>
                  {record.signed_at ? new Date(record.signed_at as unknown as string).toLocaleString() : "—"}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Consent Text</div>
              <pre
                style={{
                  marginTop: 6,
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  background: "#f9fafb",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              >
                {record.consent_text || "—"}
              </pre>
            </div>
          </div>

          {/* Files table */}
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
              Evidence Files ({files.length})
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 680,
                  borderCollapse: "separate",
                  borderSpacing: 0,
                }}
              >
                <thead style={{ textAlign: "left", background: "#fafafa" }}>
                  <tr>
                    <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Path</th>
                    <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>MIME</th>
                    <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Bytes</th>
                    <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {files.length ? (
                    files.map((f) => {
                      const url = publicUrlFor(f.path);
                      return (
                        <tr key={f.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={{ padding: 12 }}>{mono(f.path)}</td>
                          <td style={{ padding: 12 }}>{f.mime}</td>
                          <td style={{ padding: 12 }}>{f.bytes}</td>
                          <td style={{ padding: 12 }}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ textDecoration: "none", fontWeight: 600 }}
                            >
                              View / Download
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                        No files uploaded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attach evidence */}
          <div
            style={{
              marginTop: 16,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "white",
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Attach Evidence</div>
            <form method="POST" action={`/ops/authz/${id}/attach`} encType="multipart/form-data">
              <input
                type="file"
                name="files"
                multiple
                style={{
                  padding: 8,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "white",
                  width: "100%",
                }}
              />
              <div style={{ textAlign: "right", marginTop: 8 }}>
                <button
                  type="submit"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    fontWeight: 700,
                  }}
                >
                  Upload & Recompute Manifest
                </button>
              </div>
            </form>
            <p style={{ color: "#6b7280", marginTop: 6 }}>
              Upload LoA, ID, or other proofs. We’ll store them and refresh the authorization’s manifest hash.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
