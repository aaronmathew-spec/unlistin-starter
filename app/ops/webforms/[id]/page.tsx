// app/ops/webforms/[id]/page.tsx
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

async function getJob(id: string) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("webform_jobs")
    .select(
      "id, created_at, updated_at, controller_key, controller_name, status, attempts, last_error, controller_ticket_id, subject_name, subject_email, subject_phone, draft_subject, draft_body, artifact_html, artifact_screenshot, form_url"
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as any;
}

export default async function OpsWebformDetail({ params }: { params: { id: string } }) {
  // TODO: ensure admin gate via middleware/layout
  const id = params.id;
  const j = await getJob(id);

  const hasHtml = !!j.artifact_html;
  const hasShot = !!j.artifact_screenshot;

  return (
    <div className="container" style={{ padding: 24, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="h1" style={{ margin: 0 }}>Ops · Webform Job</h1>
          <div style={{ color: "#666" }}>
            ID: <code>{j.id}</code>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <form action={`/api/ops/webform/job/${encodeURIComponent(j.id)}/retry`} method="POST">
            <button type="submit" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd" }}>Retry</button>
          </form>
          <form action={`/api/ops/webform/job/${encodeURIComponent(j.id)}/cancel`} method="POST">
            <button type="submit" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #f1d0d0", background: "#fff5f5", color: "#a00" }}>Cancel</button>
          </form>
          <a
            href={`/api/ops/webform/job/${encodeURIComponent(j.id)}/pack`}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", textDecoration: "none" }}
          >
            Download Pack
          </a>
        </div>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Summary</h2>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 8 }}>
            <div className="muted">Controller</div><div>{j.controller_name} <span style={{ color: "#666" }}>({j.controller_key})</span></div>
            <div className="muted">Status</div><div>{j.status}</div>
            <div className="muted">Attempts</div><div>{j.attempts}</div>
            <div className="muted">Ticket</div><div>{j.controller_ticket_id || "—"}</div>
            <div className="muted">Form URL</div><div>{j.form_url ? <a href={j.form_url} target="_blank">{j.form_url}</a> : "—"}</div>
            <div className="muted">Created</div><div>{new Date(j.created_at).toLocaleString()}</div>
            <div className="muted">Updated</div><div>{new Date(j.updated_at).toLocaleString()}</div>
          </div>
          <div style={{ marginTop: 12, color: j.last_error ? "#a00" : "#666" }}>
            <strong>Error:</strong> {j.last_error || "—"}
          </div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Subject</h2>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 8 }}>
            <div className="muted">Name</div><div>{j.subject_name || "—"}</div>
            <div className="muted">Email</div><div>{j.subject_email || "—"}</div>
            <div className="muted">Phone</div><div>{j.subject_phone || "—"}</div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Draft</h2>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Subject</div>
          <div style={{ border: "1px solid #f0f0f0", padding: 8, borderRadius: 8, background: "#fafafa" }}>
            {j.draft_subject || "—"}
          </div>
          <div style={{ margin: "12px 0 8px", fontWeight: 600 }}>Body</div>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid #f0f0f0", padding: 12, borderRadius: 8, background: "#fafafa", maxHeight: 360, overflow: "auto" }}>
            {j.draft_body || "—"}
          </pre>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Artifacts</h2>
          {!hasHtml && !hasShot && <div className="muted">No artifacts captured.</div>}
          {hasHtml && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>HTML Capture</div>
              <iframe
                src={`/api/ops/webform/job/${encodeURIComponent(j.id)}/artifact`}
                style={{ width: "100%", height: 320, border: "1px solid #eee", borderRadius: 8 }}
              />
            </div>
          )}
          {hasShot && (
            <div>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>Screenshot</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/ops/webform/job/${encodeURIComponent(j.id)}/screenshot`}
                alt="artifact screenshot"
                style={{ maxWidth: "100%", border: "1px solid #eee", borderRadius: 8 }}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
