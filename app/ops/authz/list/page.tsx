// app/ops/authz/list/page.tsx
// Server-rendered list of Authorization records (no client JS)

import { listAuthorizations } from "@/src/lib/authz/store";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function get(sp: SP, k: string) {
  return String(sp[k] || "").trim();
}

function mono(s: string) {
  return (
    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
      {s}
    </span>
  );
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = get(searchParams, "q");
  const page = Math.max(1, Number(get(searchParams, "page") || "1") || 1);
  const limit = Math.max(1, Math.min(100, Number(get(searchParams, "limit") || "20") || 20));
  const offset = (page - 1) * limit;

  // NOTE: matches current store API: listAuthorizations(limit, offset) -> AuthorizationRecord[]
  const rowsRaw = await listAuthorizations(limit, offset);

  // Optional in-memory filtering if q provided (best-effort; does not affect server pagination)
  const rows = q
    ? rowsRaw.filter((r) => {
        const hay = [
          r.subject_full_name || "",
          r.subject_email || "",
          r.subject_phone || "",
          r.signer_name || "",
          r.region || "",
          r.manifest_hash || "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : rowsRaw;

  // We don’t know total count in this paged API; show a best-effort label.
  const total = rows.length + (page > 1 ? (page - 1) * limit : 0);
  const pages = Math.max(1, page + (rows.length === limit ? 1 : 0));

  const mkHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(p));
    params.set("limit", String(limit));
    return `/ops/authz/list?${params.toString()}`;
  };

  const exportHref = (() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return `/ops/authz/list/export?${params.toString()}`;
  })();

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Authorizations</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Browse and search signed authorizations. Click an ID to view details and evidence.
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
              background: "white",
            }}
          >
            + New Authorization
          </a>
          <a
            href={exportHref}
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
              background: "white",
            }}
          >
            ⭳ Export CSV
          </a>
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
            ← Back to Ops
          </a>
        </div>
      </div>

      {/* Search form */}
      <form method="GET" style={{ marginTop: 16 }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
            background: "white",
            display: "grid",
            gridTemplateColumns: "1fr 120px 120px 120px",
            gap: 8,
          }}
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name/email/phone/signer…"
            style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
          />
          <input
            name="page"
            type="number"
            min={1}
            defaultValue={page}
            style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
          />
          <input
            name="limit"
            type="number"
            min={1}
            max={100}
            defaultValue={limit}
            style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
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
            Apply
          </button>
        </div>
      </form>

      {/* Results table */}
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
          Results ({rows.length} shown)
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
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Contact</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Signer</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Region</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Manifest Hash</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>
                      <a
                        href={`/ops/authz/${r.id}`}
                        style={{ textDecoration: "none", fontWeight: 700 }}
                      >
                        {mono(r.id)}
                      </a>
                    </td>
                    <td style={{ padding: 12 }}>
                      {r.subject_full_name}
                    </td>
                    <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                      {r.subject_email ? <>{r.subject_email}</> : "—"}
                      {r.subject_phone ? <> · {r.subject_phone}</> : null}
                    </td>
                    <td style={{ padding: 12 }}>{r.signer_name || "—"}</td>
                    <td style={{ padding: 12 }}>{r.region || "—"}</td>
                    <td style={{ padding: 12 }}>{r.manifest_hash ? mono(r.manifest_hash) : "—"}</td>
                    <td style={{ padding: 12 }}>
                      {new Date((r as any).created_at as string).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                    No results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            padding: 12,
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fafafa",
          }}
        >
          <div style={{ color: "#6b7280", fontSize: 12 }}>
            Page {page} of {pages} · Showing {rows.length} (best-effort)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href={mkHref(Math.max(1, page - 1))}
              style={{
                textDecoration: "none",
                border: "1px solid #e5e7eb",
                padding: "6px 10px",
                borderRadius: 8,
                background: "white",
                fontWeight: 600,
                pointerEvents: page <= 1 ? "none" : undefined,
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              ← Prev
            </a>
            <a
              href={mkHref(Math.min(pages, page + 1))}
              style={{
                textDecoration: "none",
                border: "1px solid #e5e7eb",
                padding: "6px 10px",
                borderRadius: 8,
                background: "white",
                fontWeight: 600,
                pointerEvents: page >= pages ? "none" : undefined,
                opacity: page >= pages ? 0.5 : 1,
              }}
            >
              Next →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
