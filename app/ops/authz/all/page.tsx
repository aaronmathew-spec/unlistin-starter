// app/ops/authz/all/page.tsx
// Server-rendered list of authorizations (no client JS)

import { listAuthorizations } from "@/src/lib/authz/store";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
function get(sp: SP, k: string) { return String(sp[k] || "").trim(); }
function mono(v: string) {
  return <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{v}</span>;
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = get(searchParams, "q");
  const pageNum = Number(get(searchParams, "page")) || 1;
  const pageSize = 50;
  const offset = (pageNum - 1) * pageSize;

  const { rows, total } = await listAuthorizations({
    search: q || null,
    limit: pageSize,
    offset,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Authorizations</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Browse saved authorizations and open details / evidence.
          </p>
        </div>
        <a
          href="/ops/authz"
          style={{
            textDecoration: "none",
            border: "1px solid #e5e7eb",
            padding: "8px 12px",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          + New Authorization
        </a>
      </div>

      {/* Search/filter (GET) */}
      <form method="GET" style={{ marginTop: 16 }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
            background: "white",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 8,
          }}
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, phone, signer…"
            style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
          />
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
            Search
          </button>
        </div>
      </form>

      {/* Table */}
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
          Results ({rows.length} / {total})
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: 960,
              borderCollapse: "separate",
              borderSpacing: 0,
            }}
          >
            <thead style={{ textAlign: "left", background: "#fafafa" }}>
              <tr>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>ID</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Subject</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Email · Phone</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Region</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Signer</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Signed</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Manifest</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>{mono(r.id)}</td>
                    <td style={{ padding: 12 }}>{r.subject_full_name}</td>
                    <td style={{ padding: 12 }}>
                      {r.subject_email || "—"} {r.subject_phone ? ` · ${r.subject_phone}` : ""}
                    </td>
                    <td style={{ padding: 12 }}>{r.region || "—"}</td>
                    <td style={{ padding: 12 }}>{r.signer_name || "—"}</td>
                    <td style={{ padding: 12 }}>
                      {r.signed_at ? new Date(String(r.signed_at)).toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: 12 }}>
                      {r.manifest_hash ? mono(r.manifest_hash) : "—"}
                    </td>
                    <td style={{ padding: 12 }}>
                      <a
                        href={`/ops/authz/${r.id}`}
                        style={{ textDecoration: "none", fontWeight: 600 }}
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                    No results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          Page {pageNum} of {totalPages}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href={`/ops/authz/all?q=${encodeURIComponent(q || "")}&page=${Math.max(1, pageNum - 1)}`}
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
              pointerEvents: pageNum <= 1 ? "none" : undefined,
              opacity: pageNum <= 1 ? 0.5 : 1,
              background: "white",
            }}
          >
            ← Prev
          </a>
          <a
            href={`/ops/authz/all?q=${encodeURIComponent(q || "")}&page=${Math.min(totalPages, pageNum + 1)}`}
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
              pointerEvents: pageNum >= totalPages ? "none" : undefined,
              opacity: pageNum >= totalPages ? 0.5 : 1,
              background: "white",
            }}
          >
            Next →
          </a>
        </div>
      </div>
    </div>
  );
}
