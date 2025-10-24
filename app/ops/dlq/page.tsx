// app/ops/dlq/page.tsx
import { listDLQ } from "@/lib/ops/dlq";
import { actionRetryDLQ } from "./actions";

export const dynamic = "force-dynamic";

/** Small monospace pill used for terse values */
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

/** Safe JSON stringify with clipping and fallback */
function safeJsonPreview(value: unknown, max = 140): string {
  try {
    const s = JSON.stringify(value);
    if (!s) return "-";
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch {
    try {
      const s = String(value ?? "-");
      return s.length > max ? s.slice(0, max) + "…" : s;
    } catch {
      return "-";
    }
  }
}

/** Parse and clamp a number */
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function Notice({
  ok,
  err,
  note,
}: {
  ok?: boolean;
  err?: string;
  note?: string;
}) {
  if (ok) {
    return (
      <div
        style={{
          padding: 12,
          border: "1px solid #10b981",
          background: "#ecfdf5",
          borderRadius: 10,
          marginTop: 12,
        }}
      >
        ✅ Retry enqueued <span style={{ color: "#065f46" }}>{note || ""}</span>
      </div>
    );
  }
  if (err) {
    return (
      <div
        style={{
          padding: 12,
          border: "1px solid #ef4444",
          background: "#fef2f2",
          borderRadius: 10,
          marginTop: 12,
        }}
      >
        ❌ Retry failed: <b>{err}</b>
      </div>
    );
  }
  return null;
}

const FLAG_RETRY = process.env.FLAG_DLQ_RETRY === "1";

export default async function OpsDLQPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // parse filters (optional; in-memory so we don’t change your DAL)
  const qChannel =
    typeof searchParams?.channel === "string"
      ? searchParams?.channel.trim()
      : "";
  const qController =
    typeof searchParams?.controller === "string"
      ? searchParams?.controller.trim()
      : "";
  // optional limit control
  const limitRaw =
    typeof searchParams?.limit === "string" ? searchParams?.limit : undefined;
  const limit = limitRaw && !isNaN(+limitRaw) ? clamp(+limitRaw, 1, 1000) : 200;

  // status notice from redirects
  const ok = searchParams?.ok === "1";
  const err =
    typeof searchParams?.err === "string" ? searchParams?.err : undefined;
  const note =
    typeof searchParams?.note === "string" ? searchParams?.note : undefined;

  let rows = await (async () => {
    try {
      return await listDLQ(limit);
    } catch {
      return [] as Awaited<ReturnType<typeof listDLQ>>;
    }
  })();

  if (qChannel) {
    rows = rows.filter((r) => String(r.channel || "").includes(qChannel));
  }
  if (qController) {
    rows = rows.filter((r) =>
      String(r.controller_key || "").includes(qController)
    );
  }

  // Build an Export CSV link that mirrors current filters/limit.
  // /api/ops/dlq/list now supports ?format=csv (see route code below).
  const csvHref = `/api/ops/dlq/list?format=csv&limit=${encodeURIComponent(
    String(limit)
  )}${qChannel ? `&channel=${encodeURIComponent(qChannel)}` : ""}${
    qController ? `&controller=${encodeURIComponent(qController)}` : ""
  }`;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
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
          <h1 style={{ margin: 0 }}>Ops · Dead Letter Queue</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Failed dispatch or worker jobs captured for investigation.
            PII is redacted by producers. Use filters in the URL to narrow results.
          </p>
          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
            <Mono>?channel=webform</Mono>{" "}
            <Mono>?controller=truecaller</Mono>{" "}
            <Mono>?limit=500</Mono>
          </div>
          {!FLAG_RETRY && (
            <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>
              Set <Mono>FLAG_DLQ_RETRY=1</Mono> to enable retry buttons.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href="/ops/dispatch"
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            ← Back to Dispatch
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
            title="Download CSV of current view"
          >
            ⬇ Export CSV
          </a>
        </div>
      </div>

      <Notice ok={ok} err={err} note={note} />

      {/* Table */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
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
                  When
                </th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                  Channel
                </th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                  Controller
                </th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                  Subject
                </th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                  Error
                </th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                  Retries
                </th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                  Payload
                </th>
                {FLAG_RETRY && (
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const subject =
                  r.subject_id ??
                  r.payload?.subject?.email ??
                  r.payload?.subject?.phone ??
                  "-";
                const error = r.error_code
                  ? `${r.error_code}${
                      r.error_note ? ` – ${r.error_note}` : ""
                    }`
                  : r.error_note || "-";
                const payloadShort = safeJsonPreview(r.payload, 140);

                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: 12 }}>{r.channel}</td>
                    <td style={{ padding: 12 }}>
                      {r.controller_key || "-"}
                    </td>
                    <td style={{ padding: 12 }}>{subject}</td>
                    <td style={{ padding: 12 }}>
                      <Mono>{error}</Mono>
                    </td>
                    <td style={{ padding: 12 }}>{r.retries ?? 0}</td>
                    <td style={{ padding: 12 }}>
                      <Mono>{payloadShort}</Mono>
                    </td>
                    {FLAG_RETRY && (
                      <td style={{ padding: 12 }}>
                        <form action={actionRetryDLQ}>
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
                            title="Retry this item"
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
                    colSpan={FLAG_RETRY ? 8 : 7}
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    DLQ empty (or no rows match your filters).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
        Retry is behind a feature flag. Set{" "}
        <Mono>FLAG_DLQ_RETRY=1</Mono> to enable.
      </div>
    </div>
  );
}
