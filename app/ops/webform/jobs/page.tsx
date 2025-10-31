// app/ops/webform/jobs/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/src/lib/supabase/admin";

const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";

type Job = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  subject_id: string | null;
  url: string | null;
  attempts: number | null;
  error: string | null;
  created_at: string;
  claimed_at: string | null;
  finished_at: string | null;
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

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const s = supabaseAdmin();

  const qStatus =
    typeof searchParams?.status === "string"
      ? searchParams?.status.trim().toLowerCase()
      : "";
  const qController =
    typeof searchParams?.controller === "string"
      ? searchParams?.controller.trim()
      : "";
  const qSubject =
    typeof searchParams?.subject === "string"
      ? searchParams?.subject.trim()
      : "";

  const page =
    typeof searchParams?.page === "string" && !isNaN(+searchParams.page)
      ? clamp(+searchParams.page, 1, 10_000)
      : 1;
  const pageSize =
    typeof searchParams?.pageSize === "string" && !isNaN(+searchParams.pageSize)
      ? clamp(+searchParams.pageSize, 1, 200)
      : 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = s
    .from(TABLE)
    .select(
      "id,status,subject_id,url,attempts,error,created_at,claimed_at,finished_at,controller_key,controller_name,subject_name,subject_email,subject_handle",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (qStatus) q = q.eq("status", qStatus);
  if (qController) {
    // match either name or key
    q = q.or(
      `controller_key.eq.${qController},controller_name.eq.${qController}`
    );
  }
  if (qSubject) {
    // fuzzy: try email or subject fields via ilike where possible
    q = q.or(
      `subject_id.ilike.%${qSubject}%,subject_email.ilike.%${qSubject}%,subject_name.ilike.%${qSubject}%,subject_handle.ilike.%${qSubject}%`
    );
  }

  const { data, error, count } = await q;

  const rows = (data || []) as Job[];
  const total = count ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Ops · Webform Jobs</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Browse recent webform jobs with quick filters and artifact links.
          </p>
          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
            Filters: <Mono>?status=queued|running|succeeded|failed</Mono>{" "}
            <Mono>?controller=google</Mono> <Mono>?subject=a@b.com</Mono>{" "}
            <Mono>?page=2&pageSize=50</Mono>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
            ⏳ View Queue
          </a>
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #ef4444",
            background: "#fef2f2",
            borderRadius: 10,
          }}
        >
          ❌ Failed to load: {error.message}
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 980,
                borderCollapse: "separate",
                borderSpacing: 0,
              }}
            >
              <thead style={{ background: "#f9fafb", textAlign: "left" }}>
                <tr>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Created
                  </th>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Status
                  </th>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Controller
                  </th>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Subject
                  </th>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Attempts
                  </th>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Artifacts
                  </th>
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const screenshotUrl = `/api/ops/webform/job/${encodeURIComponent(
                    r.id
                  )}/screenshot`;
                  const htmlUrl = `/api/ops/webform/job/${encodeURIComponent(
                    r.id
                  )}/html`;
                  const subject =
                    r.subject_name ||
                    r.subject_email ||
                    r.subject_handle ||
                    r.subject_id ||
                    "—";
                  const controller = r.controller_name || r.controller_key || "—";

                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 12 }}>
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: 12 }}>
                        <Mono>{r.status}</Mono>
                      </td>
                      <td style={{ padding: 12 }}>
                        <a
                          href={`/ops/webform/job/${encodeURIComponent(r.id)}`}
                          style={{ textDecoration: "none" }}
                          title="Open job detail"
                        >
                          <Mono>{controller}</Mono>
                        </a>
                      </td>
                      <td style={{ padding: 12 }}>
                        <Mono>{subject}</Mono>
                      </td>
                      <td style={{ padding: 12 }}>
                        <Mono>{String(r.attempts ?? 0)}</Mono>
                      </td>
                      <td style={{ padding: 12 }}>
                        <a
                          href={htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ marginRight: 8 }}
                          title="Open HTML (new tab)"
                        >
                          🧾
                        </a>
                        <a
                          href={screenshotUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open screenshot (new tab)"
                        >
                          🖼
                        </a>
                      </td>
                      <td style={{ padding: 12, color: "#b91c1c" }}>
                        {r.error ? <Mono>{r.error}</Mono> : "—"}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      No jobs found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "#6b7280", fontSize: 12 }}>
          Page {page} / {totalPages} · Total {total}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href={`/ops/webform/jobs?${new URLSearchParams({
              ...(qStatus ? { status: qStatus } : {}),
              ...(qController ? { controller: qController } : {}),
              ...(qSubject ? { subject: qSubject } : {}),
              page: String(Math.max(1, page - 1)),
              pageSize: String(pageSize),
            }).toString()}`}
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "6px 10px",
              borderRadius: 8,
              fontWeight: 600,
              background: page <= 1 ? "#f3f4f6" : "#fff",
              color: page <= 1 ? "#9ca3af" : "#111827",
              pointerEvents: page <= 1 ? "none" : "auto",
            }}
          >
            ◀ Prev
          </a>
          <a
            href={`/ops/webform/jobs?${new URLSearchParams({
              ...(qStatus ? { status: qStatus } : {}),
              ...(qController ? { controller: qController } : {}),
              ...(qSubject ? { subject: qSubject } : {}),
              page: String(Math.min(totalPages, page + 1)),
              pageSize: String(pageSize),
            }).toString()}`}
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "6px 10px",
              borderRadius: 8,
              fontWeight: 600,
              background: page >= totalPages ? "#f3f4f6" : "#fff",
              color: page >= totalPages ? "#9ca3af" : "#111827",
              pointerEvents: page >= totalPages ? "none" : "auto",
            }}
          >
            Next ▶
          </a>
        </div>
      </div>
    </div>
  );
}
