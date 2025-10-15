// app/ops/dispatch/logs/page.tsx
import "server-only";
import { listDispatchLog } from "@/lib/dispatch/query";

export const dynamic = "force-dynamic";

function Badge({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: ok ? "#065f46" : "#991b1b",
        background: ok ? "#d1fae5" : "#fee2e2",
        border: `1px solid ${ok ? "#10b981" : "#ef4444"}`,
      }}
    >
      {ok ? "ok" : "fail"}
    </span>
  );
}

export default async function DispatchLogsPage() {
  const rows = await listDispatchLog(200);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Ops · Dispatch Logs</h1>
      <p style={{ color: "#6b7280" }}>
        Idempotent audit of auto/manual dispatches from the pipeline. Recent first.
      </p>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#f9fafb" }}>
            <tr>
              <Th>ID</Th>
              <Th>When</Th>
              <Th>Controller</Th>
              <Th>Subject</Th>
              <Th>Locale</Th>
              <Th>Channel</Th>
              <Th>Provider/Note</Th>
              <Th>Status</Th>
              <Th>Error</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <Td mono>{r.id}</Td>
                <Td mono>{new Date(r.created_at).toLocaleString()}</Td>
                <Td>{r.controller_key}</Td>
                <Td>
                  <div style={{ display: "grid" }}>
                    {r.subject_name ? <span>{r.subject_name}</span> : null}
                    {r.subject_email ? <span style={{ color: "#6b7280", fontSize: 12 }}>{r.subject_email}</span> : null}
                    {r.subject_phone ? <span style={{ color: "#6b7280", fontSize: 12 }}>{r.subject_phone}</span> : null}
                  </div>
                </Td>
                <Td>{r.locale}</Td>
                <Td>{r.channel || "-"}</Td>
                <Td>
                  <div style={{ display: "grid" }}>
                    {r.provider_id ? <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{r.provider_id}</span> : null}
                    {r.note ? <span style={{ color: "#6b7280", fontSize: 12 }}>{r.note}</span> : null}
                  </div>
                </Td>
                <Td>
                  <Badge ok={r.ok} />
                </Td>
                <Td style={{ color: r.error ? "#991b1b" : undefined }}>{r.error || "-"}</Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <Td colSpan={9} style={{ textAlign: "center", color: "#6b7280", padding: 18 }}>
                  No dispatches yet.
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, color: "#6b7280", fontSize: 13 }}>
        Tip: thresholds & channels live at <b>/ops/controllers</b>. Worker pulse + verify recheck live under your Cron.
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 12px",
        fontSize: 12,
        color: "#6b7280",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      {children}
    </th>
  );
}
function Td({
  children,
  mono,
  colSpan,
  style,
}: {
  children: React.ReactNode;
  mono?: boolean;
  colSpan?: number;
  style?: React.CSSProperties;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: "10px 12px",
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
        ...style,
      }}
    >
      {children}
    </td>
  );
}
