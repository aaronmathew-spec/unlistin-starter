// app/status/page.tsx
/* Minimal status viewer for customers.
   - Enter a Job ID to preview status and artifacts (HTML/screenshot).
   - Reads from webform_jobs (server-side) using service-role helper is avoided here;
     we DO NOT expose secrets client-side. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

type JobRow = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  created_at: string;
  finished_at: string | null;
  error: string | null;
  result: Record<string, any> | null;
};

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
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

async function loadJob(id: string): Promise<JobRow | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
  const { data } = await sb
    .from("webform_jobs")
    .select("id,status,created_at,finished_at,error,result")
    .eq("id", id)
    .single();
  return (data as JobRow | null) ?? null;
}

export default async function Status({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const id = typeof searchParams?.id === "string" ? searchParams.id.trim() : "";
  const job = id ? await loadJob(id) : null;

  const artifacts =
    job
      ? {
          html: `/api/ops/webform/job/${encodeURIComponent(job.id)}/html`,
          screenshot: `/api/ops/webform/job/${encodeURIComponent(job.id)}/screenshot`,
        }
      : null;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <a href="/" style={{ textDecoration: "none", color: "#111827" }}>← Home</a>
      <h1 style={{ marginTop: 10, marginBottom: 6 }}>Request status</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        Enter your <b>Job ID</b> to see progress and proofs when available.
      </p>

      <form method="get" style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          name="id"
          type="text"
          required
          placeholder="job_abc123..."
          defaultValue={id}
          style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, flex: 1 }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #111827",
            background: "#111827",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          View
        </button>
      </form>

      {!id ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "white",
            color: "#6b7280",
          }}
        >
          Tip: You can find your Job ID in your confirmation email.
        </div>
      ) : !job ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #ef4444",
            borderRadius: 12,
            background: "#fef2f2",
          }}
        >
          ❌ Not found. Please check the Job ID.
        </div>
      ) : (
        <>
          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "white" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Job</div>
              <div>ID: <Mono>{job.id}</Mono></div>
              <div style={{ marginTop: 6 }}>
                Status: <Mono>{job.status}</Mono>
              </div>
              <div style={{ color: "#6b7280", marginTop: 6 }}>
                Created: <Mono>{new Date(job.created_at).toLocaleString()}</Mono>
              </div>
              <div style={{ color: "#6b7280", marginTop: 6 }}>
                Finished: <Mono>{job.finished_at ? new Date(job.finished_at).toLocaleString() : "—"}</Mono>
              </div>
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "white" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Proofs</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a
                  href={artifacts!.html}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: "none",
                    border: "1px solid #e5e7eb",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontWeight: 600,
                    background: "#fff",
                  }}
                >
                  🧾 HTML
                </a>
                <a
                  href={artifacts!.screenshot}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: "none",
                    border: "1px solid #e5e7eb",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontWeight: 600,
                    background: "#fff",
                  }}
                >
                  🖼 Screenshot
                </a>
                <a
                  href={`${artifacts!.screenshot}?download=1`}
                  style={{
                    textDecoration: "none",
                    border: "1px solid #e5e7eb",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontWeight: 600,
                    background: "#fff",
                  }}
                >
                  ⬇ Download Screenshot
                </a>
              </div>
              <div style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>
                Proofs appear after we contact the controller or complete actions.
              </div>
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "white" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Notes</div>
              <div style={{ color: "#6b7280" }}>
                {job.error ? (
                  <>
                    Last error: <Mono>{job.error.slice(0, 240)}</Mono>
                  </>
                ) : (
                  "No errors recorded."
                )}
              </div>
            </div>
          </div>

          {/* Optional inline preview (best-effort image) */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Latest screenshot (inline)</div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <img
                src={artifacts!.screenshot}
                alt="screenshot"
                style={{ display: "block", width: "100%", maxHeight: 520, objectFit: "contain" }}
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
