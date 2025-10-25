// app/ops/targets/page.tsx
import { TARGET_MATRIX } from "@/src/lib/targets/matrix";

export const dynamic = "force-dynamic";

type Entry = (typeof TARGET_MATRIX.entries)[number];

function Row({ e }: { e: Entry }) {
  return (
    <tr style={{ borderTop: "1px solid #e5e7eb" }}>
      <td style={{ padding: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{e.key}</td>
      <td style={{ padding: 12 }}>{e.displayName}</td>
      <td style={{ padding: 12 }}>{e.category}</td>
      <td style={{ padding: 12 }}>{e.controllerKey ?? "-"}</td>
      <td style={{ padding: 12 }}>
        {e.prefersEmail ? "Email" : e.hasWebform ? "Webform" : "-"}
      </td>
      <td style={{ padding: 12 }}>
        {e.urls?.form ? (
          <a href={e.urls.form} rel="noreferrer" target="_blank">form</a>
        ) : (
          "-"
        )}
      </td>
      <td style={{ padding: 12 }}>
        {e.sla?.special24h
          ? "24h"
          : `${e.sla?.ackDays ?? "?"}d ack / ${e.sla?.resolveDays ?? "?"}d`}
      </td>
      <td style={{ padding: 12, color: "#6b7280" }}>
        {e.proofHints?.slice(0, 3).join(" · ") ?? "-"}
      </td>
    </tr>
  );
}

export default async function TargetsPage() {
  const items = TARGET_MATRIX.entries;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Target Matrix</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Version <code>{TARGET_MATRIX.version}</code>. Catalog of priority targets with hints for evidence and SLAs.
          </p>
        </div>
        <a
          href="/ops/dispatch"
          style={{
            textDecoration: "none",
            border: "1px solid #e5e7eb",
            padding: "8px 12px",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          ← Dispatch
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
          Targets
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: 980,
              borderCollapse: "separate",
              borderSpacing: 0,
            }}
          >
            <thead style={{ textAlign: "left", background: "#fafafa" }}>
              <tr>
                {["Key", "Name", "Category", "Controller", "Prefers", "Form URL", "SLA", "Proof (hints)"].map(
                  (h) => (
                    <th key={h} style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((e) => <Row key={e.key} e={e} />)
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    style={{ padding: 24, textAlign: "center", color: "#6b7280" }}
                  >
                    No targets yet.
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
