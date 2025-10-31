// app/ops/webform/queue/page.tsx
// Minimal Webform Job Console: lists recent jobs, quick filters, and optional admin actions.
//
// Reads directly from Supabase using your service-role admin helper (server component).
// Actions (Requeue/Delete) are enabled only when FLAG_WEBFORM_ADMIN=1.
//
// ENV required:
// - NEXT_PUBLIC_SUPABASE_URL
// - SUPABASE_SERVICE_ROLE
// - (optional) WEBFORM_JOBS_TABLE (defaults to "webform_jobs")
// - (optional) FLAG_WEBFORM_ADMIN = "1" to enable Requeue/Delete buttons

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/src/lib/supabase/admin";
import { actionRequeueJob, actionDeleteJob } from "./actions";

const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";
const ADMIN_ENABLED = process.env.FLAG_WEBFORM_ADMIN === "1";

type WebformJob = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  subject_id: string;
  url: string;
  meta: Record<string, any> | null;
  attempts: number;
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

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function safeJsonPreview(value: unknown, max = 180): string {
  try {
    const s = JSON.stringify(value);
    if (!s) return "-";
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch {
    const s = String(value ?? "-");
    return s.length > max ? s.slice(0, max) + "…" : s;
  }
}

export default async function WebformQueuePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const s = supabaseAdmin();

  const qStatus =
    typeof searchParams?.status === "string"
      ? (searchParams.status.toLowerCase() as WebformJob["status"] | "all")
      : "all";
  const qController =
    typeof searchParams?.controller === "string"
      ? searchParams.controller.trim()
      : "";
  const qSubject =
    typeof searchParams?.subject === "string"
      ? searchParams.subject.trim()
      : "";
  const qLimitRaw =
    typeof searchParams?.limit === "string" ? searchParams.limit : undefined;
  const limit = clamp(qLimitRaw ? Number(qLimitRaw) || 200 : 200, 1, 1000);

  // Base query
  let query = s
    .from(TABLE)
    .select(
      "id, status, subject_id, url, meta, attempts, error, result, created_at, claimed_at, finished_at, worker_id, controller_key, controller_name, subject_name, subject_email, subject_handle"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (qStatus && qStatus !== "all") query = query.eq("status", qStatus);
  if (qController) query = query.ilike("controller_key", `%${qController}%`);
  if (qSubject)
    query = query.or(
      `subject_id.ilike.%${qSubject}%,subject_email.ilike.%${qSubject}%,subject_name.ilike.%${qSubject}%`
    );

  const { data, error } = await query;

  const rows = (data ?? []) as WebformJob[];
  const total = rows.length;

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
          <h1 style={{ margin: 0 }}>Ops · Webform Queue</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Inspect and manage the webform submission jobs. Use{" "}
            <a href="/ops/webform/pulse">Pulse</a> to run the worker on demand.
          </p>
          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
            Filters: <Mono>?status=queued|running|succeeded|failed|all</Mono>{" "}
            <Mono>?controller=truecaller</Mono> <Mono>?subject=alice@</Mono>{" "}
            <Mono>?limit=500</Mono>
          </div>
          {!ADMIN_ENABLED && (
            <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>
              Set <Mono>FLAG_WEBFORM_ADMIN=1</Mono> to enable requeue/delete.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
            href="/ops/dlq"
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            DLQ
          </a>
        </div>
      </div>

      {/* Error */}
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
          ❌ Failed to load queue: <b>{String(error.message)}</b>
        </div>
      ) : null}

      {/* Summary */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "white",
            borderRadius: 10,
            padding: 12,
          }}
        >
          Total <Mono>{String(total)}</Mono>
        </div>
        {(["queued", "running", "succeeded", "failed"] as const).map((st) => (
          <div
            key={st}
            style={{
              border: "1px solid #e5e7eb",
              background: "white",
              borderRadius: 10,
              padding: 12,
            }}
          >
            {st}{" "}
            <Mono>{String(rows.filter((r) => r.status === st).length)}</Mono>
          </div>
        ))}
      </div>

      {/* Table */}
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
              minWidth: 1100,
              borderCollapse: "separate",
              borderSpacing: 0,
            }}
          >
            <thead style={{ background: "#f9fafb", textAlign: "left" }}>
              <tr>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                  When
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
                  URL
                </th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                  Error / Result
                </th>
                {ADMIN_ENABLED && (
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Actions
                  </th>
                )}
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
                  r.subject_email ||
                  r.subject_id ||
                  r.meta?.subject?.email ||
                  r.meta?.subject?.name ||
                  "-";
                const url = r.meta?.formUrl || r.url || "-";
                const resultShort =
                  r.error?.slice(0, 160) ||
                  (r.result ? safeJsonPreview(r.result, 160) : "-");

                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: 12 }}>{r.status}</td>
                    <td style={{ padding: 12 }}>
                      <Mono>{controller}</Mono>
                    </td>
                    <td style={{ padding: 12 }}>
                      <Mono>{subject}</Mono>
                    </td>
                    <td style={{ padding: 12 }}>{r.attempts ?? 0}</td>
                    <td style={{ padding: 12 }}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <Mono>{url}</Mono>
                      </a>
                    </td>
                    <td style={{ padding: 12 }}>
                      <Mono>{resultShort}</Mono>
                    </td>
                    {ADMIN_ENABLED && (
                      <td style={{ padding: 12 }}>
                        <form
                          action={actionRequeueJob}
                          style={{ display: "inline-block", marginRight: 6 }}
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #111827",
                              background: "#111827",
                              color: "white",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            title="Requeue"
                          >
                            Requeue
                          </button>
                        </form>
                        <form
                          action={actionDeleteJob}
                          style={{ display: "inline-block" }}
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #ef4444",
                              background: "white",
                              color: "#ef4444",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            title="Delete"
                          >
                            Delete
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={ADMIN_ENABLED ? 8 : 7}
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    No jobs match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
        Tip: Use <a href="/ops/webform/pulse">Pulse</a> to run the worker now.
      </div>
    </div>
  );
}
