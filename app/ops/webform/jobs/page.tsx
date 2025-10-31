// app/ops/webform/jobs/page.tsx
import { listWebformJobs } from "@/lib/webform/list";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 12,
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        padding: "2px 6px",
        borderRadius: 6,
      }}
    >
      {children}
    </code>
  );
}

function Badge({ text, tone }: { text: string; tone: "ok" | "warn" | "err" | "muted" }) {
  const styles: Record<string, React.CSSProperties> = {
    ok: { background: "#ecfdf5", borderColor: "#10b981", color: "#065f46" },
    warn: { background: "#fffbeb", borderColor: "#f59e0b", color: "#92400e" },
    err: { background: "#fef2f2", borderColor: "#ef4444", color: "#991b1b" },
    muted: { background: "#f3f4f6", borderColor: "#e5e7eb", color: "#374151" },
  };
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        border: "1px solid",
        borderRadius: 999,
        ...styles[tone],
      }}
    >
      {text}
    </span>
  );
}

function toneForStatus(s: string): "ok" | "warn" | "err" | "muted" {
  if (s === "succeeded") return "ok";
  if (s === "running") return "warn";
  if (s === "failed") return "err";
  return "muted";
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const limitRaw = (searchParams?.limit as string) || "200";
  const limit = Math.max(1, Math.min(1000, Number(limitRaw) || 200));

  const rows = await listWebformJobs(limit);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Webform Jobs</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Latest webform automation jobs. Click a Job ID for details, inline screenshot & HTML.
          </p>
          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
            <Mono>?limit=500</Mono>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href="/ops/dlq"
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            DLQ →
          </a>
        </div>
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
        <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", fontWeight: 600 }}>
          Recent Jobs
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1000, borderCollapse: "separate", borderSpacing: 0 }}>
            <thead style={{ textAlign: "left", background: "#fafafa" }}>
              <tr>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Job ID</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Status</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Controller</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Subject</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Attempts</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Created</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Links</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const controller =
                  r.controller_name ||
                  r.controller_key ||
                  r.meta?.controllerName ||
                  r.meta?.controllerKey ||
                  "-";
                const subject =
                  r.subject_name ||
                  r.meta?.subject?.name ||
                  r.subject_email ||
                  r.meta?.subject?.email ||
                  r.subject_handle ||
                  r.meta?.subject?.handle ||
                  "-";
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>
                      <a
                        href={`/ops/webform/job/${encodeURIComponent(r.id)}`}
                        style={{ textDecoration: "none", fontWeight: 600 }}
                      >
                        {r.id}
                      </a>
                    </td>
                    <td style={{ padding: 12 }}>
                      <Badge text={r.status} tone={toneForStatus(r.status)} />
                    </td>
                    <td style={{ padding: 12 }}>{controller}</td>
                    <td style={{ padding: 12 }}>{subject}</td>
                    <td style={{ padding: 12 }}>{r.attempts}</td>
                    <td style={{ padding: 12 }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: 12, display: "flex", gap: 8 }}>
                      <a
                        href={`/api/ops/webform/job/${encodeURIComponent(r.id)}/screenshot`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12 }}
                        title="Open screenshot"
                      >
                        Screenshot
                      </a>
                      <a
                        href={`/api/ops/webform/job/${encodeURIComponent(r.id)}/screenshot?download=1`}
                        style={{ fontSize: 12 }}
                        title="Download screenshot"
                      >
                        Download
                      </a>
                      <a
                        href={`/api/ops/webform/job/${encodeURIComponent(r.id)}/html`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12 }}
                        title="Open HTML"
                      >
                        HTML
                      </a>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                    No jobs found.
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
