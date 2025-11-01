// app/ops/webform/job/[id]/page.tsx
// Webform Job Detail: inspect one job (summary, meta/result JSON, HTML & screenshot preview links)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/src/lib/supabase/admin";

const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";

type Job = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  subject_id: string | null;
  url: string | null;
  meta: Record<string, any> | null;
  attempts: number | null;
  error: string | null;
  result: Record<string, any> | null;
  created_at: string;
  claimed_at: string | null;
  finished_at: string | null;
  worker_id: string | null;

  controller_key?: string | null;
  controller_name?: string | null;
  subject_name?: string | null;
  subject_email?: string | null;
  subject_handle?: string | null;
};

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

function Box({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        background: "white",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

export default async function Page({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id || "");
  const s = supabaseAdmin();

  const { data, error } = await s
    .from(TABLE)
    .select(
      [
        "id",
        "status",
        "subject_id",
        "url",
        "meta",
        "attempts",
        "error",
        "result",
        "created_at",
        "claimed_at",
        "finished_at",
        "worker_id",
        "controller_key",
        "controller_name",
        "subject_name",
        "subject_email",
        "subject_handle",
      ].join(",")
    )
    .eq("id", id)
    .single();

  const job = (data as Job | null) ?? null;

  const screenshotUrl = `/api/ops/webform/job/${encodeURIComponent(id)}/screenshot`;
  const htmlUrl = `/api/ops/webform/job/${encodeURIComponent(id)}/html`;
  const htmlDownloadUrl = `${htmlUrl}?download=1`;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Ops · Webform Job</h1>
          <div style={{ marginTop: 6, color: "#6b7280" }}>
            ID: <Mono>{id || "—"}</Mono>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href="/ops/webform/jobs"
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            ← Back to Jobs
          </a>
          <a
            href="/ops/webform/queue"
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            ← Back to Queue
          </a>
          <a
            href="/ops/webform/pulse"
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            ▶ Pulse Worker
          </a>
        </div>
      </div>

      {/* Error / Not found */}
      {error || !job ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #ef4444",
            background: "#fef2f2",
            borderRadius: 10,
          }}
        >
          ❌ {error ? `Failed to load: ${error.message}` : "Job not found"}
        </div>
      ) : (
        <>
          {/* Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <Box title="Status">
              <div style={{ fontSize: 18, fontWeight: 700 }}>{job.status}</div>
              <div style={{ color: "#6b7280", marginTop: 6 }}>
                Attempts: <Mono>{String(job.attempts ?? 0)}</Mono>
              </div>
            </Box>
            <Box title="Controller">
              <div>
                <Mono>
                  {job.controller_name ||
                    job.controller_key ||
                    job.meta?.controllerName ||
                    job.meta?.controllerKey ||
                    "-"}
                </Mono>
              </div>
              <div style={{ color: "#6b7280", marginTop: 6 }}>
                Subject:{" "}
                <Mono>
                  {job.subject_name ||
                    job.subject_email ||
                    job.subject_handle ||
                    job.subject_id ||
                    job.meta?.subject?.name ||
                    job.meta?.subject?.email ||
                    job.meta?.subject?.handle ||
                    "-"}
                </Mono>
              </div>
            </Box>
            <Box title="Timestamps">
              <div>
                Created:{" "}
                <Mono>{new Date(job.created_at).toLocaleString()}</Mono>
              </div>
              <div>
                Claimed:{" "}
                <Mono>
                  {job.claimed_at
                    ? new Date(job.claimed_at).toLocaleString()
                    : "—"}
                </Mono>
              </div>
              <div>
                Finished:{" "}
                <Mono>
                  {job.finished_at
                    ? new Date(job.finished_at).toLocaleString()
                    : "—"}
                </Mono>
              </div>
              <div>
                Worker: <Mono>{job.worker_id || "—"}</Mono>
              </div>
            </Box>
            <Box title="Form URL">
              {job.url ? (
                <a href={job.url} target="_blank" rel="noreferrer">
                  <Mono>{job.url}</Mono>
                </a>
              ) : (
                <Mono>—</Mono>
              )}
            </Box>
          </div>

          {/* Quick actions */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <a
              href={htmlUrl}
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
              title="Open captured HTML (if present) in a new tab"
            >
              🧾 View HTML
            </a>
            <a
              href={htmlDownloadUrl}
              style={{
                textDecoration: "none",
                border: "1px solid #e5e7eb",
                padding: "8px 12px",
                borderRadius: 8,
                fontWeight: 600,
                background: "#fff",
              }}
              title="Download captured HTML"
            >
              ⬇ Download HTML
            </a>
            <a
              href={screenshotUrl}
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
              title="Open screenshot (if present) in a new tab"
            >
              🖼 View Screenshot
            </a>
            <a
              href={`${screenshotUrl}?download=1`}
              style={{
                textDecoration: "none",
                border: "1px solid #e5e7eb",
                padding: "8px 12px",
                borderRadius: 8,
                fontWeight: 600,
                background: "#fff",
              }}
              title="Download screenshot"
            >
              ⬇ Download Screenshot
            </a>
          </div>

          {/* Inline previews */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr",
              gap: 12,
              marginTop: 16,
            }}
          >
            <Box title="Screenshot (inline)">
              <div style={{ marginTop: 4 }}>
                <img
                  src={screenshotUrl}
                  alt="screenshot"
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                  }}
                />
              </div>
            </Box>
            <Box title="HTML (inline preview)">
              <div
                style={{
                  marginTop: 4,
                  maxHeight: 420,
                  overflow: "auto",
                  background: "#0b1020",
                  borderRadius: 8,
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    whiteSpace: "pre-wrap",
                    color: "#e5e7eb",
                    fontSize: 12,
                  }}
                >
                  {String(
                    (job.result?.html ||
                      job.result?.page_html ||
                      job.result?.raw_html ||
                      "")
                  ).slice(0, 100_000) || "—"}
                </pre>
              </div>
            </Box>
          </div>

          {/* Meta / Result / Error JSON */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <Box title="Meta">
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {JSON.stringify(job.meta ?? {}, null, 2)}
              </pre>
            </Box>
            <Box title="Result JSON">
              {job.result ? (
                <pre
                  style={{
                    margin: 0,
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {JSON.stringify(job.result, null, 2)}
                </pre>
              ) : (
                <div style={{ color: "#6b7280" }}>—</div>
              )}
            </Box>
            <Box title="Error">
              {job.error ? (
                <pre
                  style={{
                    margin: 0,
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color: "#b91c1c",
                  }}
                >
                  {job.error}
                </pre>
              ) : (
                <div style={{ color: "#6b7280" }}>—</div>
              )}
            </Box>
          </div>
        </>
      )}
    </div>
  );
}
