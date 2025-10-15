// app/ops/system/page.tsx
import { gatherSystemStatus } from "@/lib/system/health";

export const dynamic = "force-dynamic"; // always fresh on load

function Badge({ ok }: { ok: boolean }) {
  const bg = ok ? "#10b981" : "#ef4444";
  const txt = ok ? "OK" : "ISSUE";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: "white",
        background: bg,
      }}
    >
      {txt}
    </span>
  );
}

function KVPairs({ obj }: { obj?: Record<string, unknown> }) {
  if (!obj) return null;
  const entries = Object.entries(obj);
  if (!entries.length) return null;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td style={{ padding: "4px 8px", width: 180, color: "#6b7280" }}>{k}</td>
            <td style={{ padding: "4px 8px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
              {typeof v === "boolean" ? (v ? "true" : "false") : String(v)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function SystemStatusPage() {
  // TODO: ensure admin-only guard via existing isAdmin() middleware/layout
  const status = gatherSystemStatus();
  const env = process.env.VERCEL_ENV || "unknown";
  const proj = process.env.VERCEL_PROJECT_PRODUCTION_URL || null;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · System Status</h1>
          <div style={{ color: "#6b7280", marginTop: 4 }}>
            Environment: <b>{env}</b> {proj ? <>· Project: <a href={`https://${String(proj).replace(/^https?:\/\//, "")}`} target="_blank">{proj}</a></> : null}
          </div>
        </div>
        <div>
          <Badge ok={status.ok} />
        </div>
      </header>

      <section style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {status.checks.map((c) => (
          <div
            key={c.name}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{c.name}</h3>
              <Badge ok={c.ok} />
            </div>
            {c.details ? <KVPairs obj={c.details} /> : null}
            {c.hint ? (
              <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>Hint:</span> {c.hint}
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fcfdfd" }}>
          <h3 style={{ marginTop: 0 }}>Quick Links</h3>
          <ul style={{ margin: "8px 0 0 16px" }}>
            <li><a href="/ops/webforms">Webform Jobs</a></li>
            <li><a href="/ops/overview">Ops Overview</a></li>
            <li><a href="/ops/webforms">Download Packs / Retry / Cancel</a></li>
          </ul>
        </div>
      </section>
    </div>
  );
}
