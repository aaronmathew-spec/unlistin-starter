// app/ops/targets/page.tsx
import { TARGET_MATRIX } from "@/src/lib/targets/matrix";

export const dynamic = "force-dynamic";

export default async function TargetsPage() {
  const items = TARGET_MATRIX.entries;
  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Target Matrix</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Version <code>{TARGET_MATRIX.version}</code>. Use this to guide routing, SLAs, and evidence.
          </p>
        </div>
        <a href="/ops/dispatch" style={{ textDecoration: "none", border: "1px solid #e5e7eb", padding: "8px 12px", borderRadius: 8, fontWeight: 600 }}>
          ← Dispatch
        </a>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", fontWeight: 600 }}>
          Targets
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 960, borderCollapse: "separate", borderSpacing: 0 }}>
            <thead style={{ textAlign: "left", background: "#fafafa" }}>
              <tr>
                {["Key","Name","Category","Controller","Prefers","Form URL","SLA","Proof"].map(h => (
                  <th key={h} style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.key} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ padding: 12, fontFamily: "ui-monospace,Menlo,Consolas,monospace" }}>{t.key}</td>
                  <td style={{ padding: 12 }}>{t.displayName}</td>
                  <td style={{ padding: 12 }}>{t.category}</td>
                  <td style={{ padding: 12 }}>{t.controllerKey ?? "-"}</td>
                  <td style={{ padding: 12 }}>
                    {t.prefersEmail ? "Email" : t.hasWebform ? "Webform" : "-"}
                  </td>
                  <td style={{ padding: 12 }}>
                    {t.urls?.form ? <a href={t.urls.form} target="_blank">form</a> : "-"}
                  </td>
                  <td style={{ padding: 12 }}>
                    {t.sla?.special24h ? "24h" : `${t.sla?.ackDays ?? "?"}d ack / ${t.sla?.resolveDays ?? "?"}d`}
                  </td>
                  <td style={{ padding: 12, color: "#6b7280" }}>
                    {t.proofHints?.slice(0,3).join(" · ") ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
