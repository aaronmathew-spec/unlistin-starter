// app/ops/targets/matrix/page.tsx
// Read-only browser for the Top-50 target matrix.
// No DB access; pure static data from src/lib/targets/starter50.

import { STARTER_50, type TargetEntry, type TargetCategory } from "@/src/lib/targets/starter50";

export const dynamic = "force-dynamic";

const CATEGORIES: { key: TargetCategory; label: string }[] = [
  { key: "caller_id", label: "Caller-ID" },
  { key: "big_social", label: "Big Social / UGC" },
  { key: "india_short_video", label: "India Short-Video" },
  { key: "messaging_public", label: "Messaging (Public)" },
  { key: "search_index", label: "Search Index" },
  { key: "people_search", label: "People Search" },
  { key: "creator_db", label: "Creator DBs" },
  { key: "jobs_professional", label: "Jobs / Professional" },
  { key: "ecommerce_classifieds", label: "E-commerce / Classifieds" },
  { key: "dating_matrimony", label: "Dating & Matrimony" },
  { key: "misc_adtech", label: "Misc / Adtech" },
];

function tag(
  label: string,
  style: React.CSSProperties = {},
  title?: string,
): JSX.Element {
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        border: "1px solid #e5e7eb",
        borderRadius: 999,
        fontSize: 12,
        background: "#f9fafb",
        marginRight: 6,
        ...style,
      }}
    >
      {label}
    </span>
  );
}

function Row({ t }: { t: TargetEntry }) {
  return (
    <tr style={{ borderTop: "1px solid #e5e7eb" }}>
      <td style={{ padding: 12 }}>
        <div style={{ fontWeight: 600 }}>{t.name}</div>
        <div style={{ color: "#6b7280", fontSize: 12 }}>{t.key}</div>
      </td>
      <td style={{ padding: 12 }}>
        {t.preferredChannels.map((c) => tag(c.toUpperCase()))}
      </td>
      <td style={{ padding: 12 }}>{t.typicalSLA_days ?? "—"}</td>
      <td style={{ padding: 12 }}>
        {(t.evidence || []).map((e) => tag(e.replace(/_/g, " ")))}
      </td>
      <td style={{ padding: 12 }}>{(t.regions || []).join(", ") || "—"}</td>
      <td style={{ padding: 12, color: "#374151" }}>{t.notes ?? "—"}</td>
    </tr>
  );
}

function Section({ cat, items }: { cat: TargetCategory; items: TargetEntry[] }) {
  const meta = CATEGORIES.find((c) => c.key === cat)!;
  return (
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
        {meta.label}
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
              <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Target</th>
              <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Preferred Channels</th>
              <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>SLA (days)</th>
              <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Evidence</th>
              <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Regions</th>
              <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((t) => <Row key={t.key} t={t} />)
            ) : (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                  No items.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page() {
  // Group by category in the same order as CATEGORIES
  const byCat = new Map<TargetCategory, TargetEntry[]>();
  for (const c of CATEGORIES) byCat.set(c.key, []);
  for (const t of STARTER_50) {
    const list = byCat.get(t.category);
    if (list) list.push(t);
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Target Matrix</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Typed catalog for routing & SLAs. Read-only; no DB required. Wire into planner next.
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

      {CATEGORIES.map(({ key }) => (
        <Section key={key} cat={key} items={byCat.get(key) ?? []} />
      ))}
    </div>
  );
}
