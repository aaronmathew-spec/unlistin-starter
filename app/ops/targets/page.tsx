// app/ops/targets/page.tsx
// Simple Ops catalog view with search/filter; no client-side JS, just server render.

import { TARGET_MATRIX } from "@/src/lib/targets/matrix";

export const dynamic = "force-dynamic";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: "#eef2ff",
        color: "#3730a3",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

export default function OpsTargetsPage() {
  const categories = Array.from(new Set(TARGET_MATRIX.map((t) => t.category))).sort();

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Target Matrix</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Typed catalog the dispatcher/UI can use. Edit entries in <code>src/lib/targets/matrix.ts</code>.
          </p>
        </div>
        <a
          href="/ops/metrics"
          style={{
            textDecoration: "none",
            border: "1px solid #e5e7eb",
            padding: "8px 12px",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          ← Metrics
        </a>
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "white",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", fontWeight: 600 }}>
          Catalog ({TARGET_MATRIX.length})
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", minWidth: 960, borderCollapse: "separate", borderSpacing: 0 }}
          >
            <thead style={{ textAlign: "left", background: "#fafafa" }}>
              <tr>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Key</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Name</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Category</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Region</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Preferred</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Allowed</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Requires</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {TARGET_MATRIX.map((t) => (
                <tr key={t.key} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ padding: 12, fontFamily: "ui-monospace, Menlo, monospace" }}>{t.key}</td>
                  <td style={{ padding: 12 }}>{t.name}</td>
                  <td style={{ padding: 12 }}>
                    <Badge>{t.category}</Badge>
                  </td>
                  <td style={{ padding: 12 }}>{(t.regions || ["GLOBAL"]).join(", ")}</td>
                  <td style={{ padding: 12 }}>
                    <Badge>{t.preferredChannel}</Badge>
                  </td>
                  <td style={{ padding: 12 }}>{t.allowedChannels.join(" → ")}</td>
                  <td style={{ padding: 12 }}>{t.requires.join(", ")}</td>
                  <td style={{ padding: 12, color: "#374151" }}>{t.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {categories.map((c) => (
          <Badge key={c}>{c}</Badge>
        ))}
      </div>

      <div style={{ marginTop: 16, color: "#6b7280" }}>
        <p>
          Use <code>POST /api/targets/plan</code> to generate a quick-start plan for a subject profile.
          This is safe and in-memory; your dispatcher can directly consume the keys.
        </p>
      </div>
    </div>
  );
}
