// app/ops/dlq/page.tsx
// Ops DLQ Console: list + filter + retry + CSV export
//
// Depends on:
// - src/lib/ops/dlq.ts (you already have it)
// - app/ops/dlq/actions.ts (you already have it)
// - app/api/ops/dlq/list/route.ts (you already have it)
// - src/lib/supabase/admin (present in your repo)
// - src/lib/ops/notices (added below for friendly banners)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/src/lib/supabase/admin";
import { actionRetryDLQ } from "./actions";
import { getNoticeFromSearch } from "@/src/lib/ops/notices";

const ADMIN_RETRY = process.env.FLAG_DLQ_RETRY === "1";

type Row = {
  id: string | number;
  created_at: string;
  channel: string | null;
  controller_key: string | null;
  subject_id: string | null;
  payload: Record<string, any> | null;
  error_code: string | null;
  error_note: string | null;
  retries: number | null;
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

export default async function DLQPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const s = supabaseAdmin();

  const qController =
    typeof searchParams?.controller === "string"
      ? searchParams.controller.trim()
      : "";
  const qChannel =
    typeof searchParams?.channel === "string"
      ? searchParams.channel.trim()
      : "";
  const qLimitRaw =
    typeof searchParams?.limit === "string" ? searchParams.limit : undefined;
  const limit = clamp(qLimitRaw ? Number(qLimitRaw) || 200 : 200, 1, 1000);

  const notice = getNoticeFromSearch(searchParams);

  let query = s
    .from("ops_dlq")
    .select(
      "id, created_at, channel, controller_key, subject_id, payload, error_code, error_note, retries"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (qController) query = query.ilike("controller_key", `%${qController}%`);
  if (qChannel) query = query.ilike("channel", `%${qChannel}%`);

  const { data, error } = await query;
  const rows = (data ?? []) as Row[];

  // CSV export href (re-uses your API route)
  const csvHref = `/api/ops/dlq/list?format=csv&limit=${encodeURIComponent(
    String(limit)
  )}${
    qController ? `&controller=${encodeURIComponent(qController)}` : ""
  }${qChannel ? `&channel=${encodeURIComponent(qChannel)}` : ""}`;

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
          <h1 style={{ margin: 0 }}>Ops · DLQ</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Dead-letter queue for failed dispatch attempts. Retry requires{" "}
            <Mono>FLAG_DLQ_RETRY=1</Mono>.
          </p>
          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
            Filters: <Mono>?controller=truecaller</Mono>{" "}
            <Mono>?channel=webform</Mono> <Mono>?limit=500</Mono>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
            href={csvHref}
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
              background: "#fff",
            }}
            title="Download CSV of current DLQ view"
          >
            ⬇ Export CSV
          </a>
        </div>
      </div>

      {/* Notices */}
      {notice ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: `1px solid ${notice.kind === "error" ? "#ef4444" : "#10b981"}`,
            background: notice.kind === "error" ? "#fef2f2" : "#ecfdf5",
            borderRadius: 10,
            color: notice.kind === "error" ? "#991b1b" : "#065f46",
            fontWeight: 600,
          }}
        >
          {notice.message}
        </div>
      ) : null}

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
          ❌ Failed to load DLQ: <b>{String(error.message)}</b>
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
          Total <Mono>{String(rows.length)}</Mono>
        </div>
        {["webform", "email"].map((ch) => (
          <div
            key={ch}
            style={{
              border: "1px solid #e5e7eb",
              background: "white",
              borderRadius: 10,
              padding: 12,
            }}
          >
            {ch}{" "}
            <Mono>{String(rows.filter((r) => (r.channel || "") === ch).length)}</Mono>
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
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>When</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Channel</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Controller</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Subject</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Retries</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Error</th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Payload</th>
                {ADMIN_RETRY && (
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const subject =
                  r.subject_id ||
                  r.payload?.subject?.email ||
                  r.payload?.subject?.name ||
                  "-";
                const err = r.error_code || r.error_note || "-";
                const payloadShort = safeJsonPreview(r.payload, 160);

                return (
                  <tr key={String(r.id)} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: 12 }}>
                      <Mono>{r.channel || "—"}</Mono>
                    </td>
                    <td style={{ padding: 12 }}>
                      <Mono>{r.controller_key || "—"}</Mono>
                    </td>
                    <td style={{ padding: 12 }}>
                      <Mono>{subject}</Mono>
                    </td>
                    <td style={{ padding: 12 }}>
                      <Mono>{String(r.retries ?? 0)}</Mono>
                    </td>
                    <td style={{ padding: 12 }}>
                      <Mono>{err}</Mono>
                    </td>
                    <td style={{ padding: 12 }}>
                      <Mono>{payloadShort}</Mono>
                    </td>
                    {ADMIN_RETRY && (
                      <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                        <form action={actionRetryDLQ} style={{ display: "inline-block" }}>
                          <input type="hidden" name="id" value={String(r.id)} />
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
                            title="Retry"
                          >
                            Retry
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
                    colSpan={ADMIN_RETRY ? 8 : 7}
                    style={{ padding: 24, textAlign: "center", color: "#6b7280" }}
                  >
                    DLQ is empty (or filters removed everything).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
        Tip: Enable retries with <Mono>FLAG_DLQ_RETRY=1</Mono>. Use the CSV export for audits.
      </div>
    </div>
  );
}
