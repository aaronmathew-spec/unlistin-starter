// app/ops/webforms/page.tsx
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic"; // ensure fresh data

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

async function getJobs() {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("webform_jobs")
    .select(
      "id, created_at, updated_at, controller_key, controller_name, status, attempts, last_error, controller_ticket_id, artifact_html, artifact_screenshot"
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export default async function OpsWebformsPage() {
  // TODO: ensure admin guard via middleware/layout
  const jobs = await getJobs();

  return (
    <div className="container" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 className="h1">Ops · Webform Jobs</h1>
          <p className="muted">Recent 50 jobs</p>
        </div>
      </div>

      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Controller</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Ticket</th>
              <th>Error</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Pack</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j: any) => {
              const hasArtifacts = !!(j.artifact_html || j.artifact_screenshot);
              const canRetry = j.status === "failed" || j.status === "running" || j.status === "queued";
              return (
                <tr key={j.id}>
                  <td style={{ fontFamily: "monospace" }}>{j.id}</td>
                  <td>
                    {j.controller_name}{" "}
                    <span style={{ color: "#666" }}>({j.controller_key})</span>
                  </td>
                  <td>{j.status}</td>
                  <td style={{ textAlign: "center" }}>{j.attempts}</td>
                  <td>{j.controller_ticket_id || "—"}</td>
                  <td style={{ maxWidth: 360, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {j.last_error || "—"}
                  </td>
                  <td>{new Date(j.created_at).toLocaleString()}</td>
                  <td>{new Date(j.updated_at).toLocaleString()}</td>
                  <td>
                    {hasArtifacts ? (
                      <a href={`/api/ops/webform/job/${encodeURIComponent(j.id)}/pack`} style={{ textDecoration: "none" }}>
                        Download Pack
                      </a>
                    ) : (
                      <span style={{ color: "#888" }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <form
                        action={`/api/ops/webform/job/${encodeURIComponent(j.id)}/retry`}
                        method="POST"
                        style={{ display: "inline" }}
                      >
                        <button
                          type="submit"
                          disabled={!canRetry}
                          title={canRetry ? "Queue this job again" : "Not retryable"}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: canRetry ? "#fff" : "#f5f5f5",
                            cursor: canRetry ? "pointer" : "not-allowed",
                          }}
                        >
                          Retry
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!jobs.length && (
              <tr>
                <td colSpan={10} style={{ padding: 24, textAlign: "center", color: "#666" }}>
                  No jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
