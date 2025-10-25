// app/ops/authz/index/page.tsx
// Minimal finder for Authorization records (server-rendered, no client JS)

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SP = Record<string, string | string[] | undefined>;

function get(sp: SP, key: string) {
  return String(sp[key] || "").trim();
}

function mono(v: string) {
  return (
    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
      {v}
    </span>
  );
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const id = get(searchParams, "id");

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Authorization Finder</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Look up a specific Authorization by ID and view details.
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
          ← Back to Ops
        </a>
      </div>

      <form method="GET" style={{ marginTop: 16 }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            background: "white",
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ gridColumn: "span 2 / span 2" }}>
            <label style={{ fontSize: 12, color: "#6b7280" }}>Authorization ID</label>
            <input
              name="id"
              defaultValue={id}
              placeholder="authz_123..."
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </div>

          <div style={{ textAlign: "right", gridColumn: "span 2 / span 2" }}>
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
              Find
            </button>
          </div>
        </div>
      </form>

      {id ? (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "white",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Authorization</div>
                <div style={{ marginTop: 2 }}>{mono(id)}</div>
              </div>
              <div>
                <a
                  href={`/ops/authz/${encodeURIComponent(id)}`}
                  style={{
                    textDecoration: "none",
                    border: "1px solid #e5e7eb",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontWeight: 600,
                  }}
                >
                  Open Detail →
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
