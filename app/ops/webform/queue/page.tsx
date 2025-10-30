// app/ops/webform/queue/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listWebformJobs, getWebformCounts } from "@/src/lib/webform/dao";
import { actionRequeue, actionCancel } from "@/app/ops/webform/actions";

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

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        border: `1px solid ${color}`,
        color,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: "#fff",
      }}
      title={label}
    >
      {label}: {value}
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

const FLAG_WEBFORM_RETRY = process.env.FLAG_WEBFORM_RETRY === "1";
const OPS_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();

export default async function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qStatus =
    typeof searchParams?.status === "string" ? searchParams?.status.trim() : "";
  const qLimit =
    typeof searchParams?.limit === "string" ? Number(searchParams?.limit) : 200;
  const limit = Number.isFinite(qLimit) ? clamp(qLimit as number, 1, 1000) : 200;

  // Data
  const [counts, jobs] = await Promise.all([
    getWebformCounts(),
    listWebformJobs({ status: qStatus || undefined, limit }),
  ]);

  // Build export link (CSV behind flag or with header; this is just link construction)
  const csvHref = `/api/ops/webform/list?format=csv&limit=${encodeURIComponent(
    String(limit)
  )}${qStatus ? `&status=${encodeURIComponent(qStatus)}` : ""}`;

  const ok = searchParams?.ok === "1";
  const err =
    typeof searchParams?.err === "string" ? searchParams?.err : undefined;
  const note =
    typeof searchParams?.note === "string" ? searchParams?.note : undefined;

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
          <h1 style={{ margin: 0 }}>Ops · Webform Queue</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Live view of the Playwright webform queue. Use{" "}
            <Mono>?status=queued</Mono> and <Mono>?limit=500</Mono> to filter.
          </p>
          {!OPS_SECRET && (
            <div style={{ marginTop: 4, color: "#b91c1c", fontSize: 12 }}>
              SECURE_CRON_SECRET not set — export API will reject JSON calls.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href="/ops/webform/pulse"
            style={{
              textDecoration: "none",
              border: "1px solid #111827",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 600,
              background: "#111827",
              color: "white",
            }}
            title="Trigger one pulse of the worker"
          >
            ▶ Pulse Worker
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
            title="Download CSV"
          >
            ⬇ Export CSV
          </a>
        </div>
      </div>

      {/* Counts */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <Pill label="Queued" value={counts.queued} color="#1f2937" />
        <Pill label="Running" value={counts.running} color="#2563eb" />
        <Pill label="Failed" value={counts.failed} color="#dc2626" />
        <Pill label="Succeeded" value={counts.succeeded} color="#059669" />
        <Pill label="Total" value={counts.total} color="#6b7280" />
      </div>

      {/* Status notice */}
      {ok && (
        <div
          style={{
            padding: 12,
            border: "1px solid #10b981",
            background: "#ecfdf5",
            borderRadius: 10,
            marginTop: 12,
          }}
        >
          ✅ {note || "Done"}
        </div>
      )}
      {err && (
        <div
          style={{
            padding: 12,
            border: "1px solid #ef4444",
            background: "#fef2f2",
            borderRadius: 10,
            marginTop: 12,
          }}
        >
          ❌ {err}
        </div>
      )}

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
                  Error
                </th>
                <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                  URL
                </th>
                {FLAG_WEBFORM_RETRY && (
                  <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const subject =
                  j.subject_name ||
                  j.subject_email ||
                  j.subject_phone ||
                  j.subject_id ||
                  "-";
                const ctrl = j.controller_name || j.controller_key || "-";
                return (
                  <tr key={j.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12 }}>
                      {new Date(j.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: 12 }}>{j.status}</td>
                    <td style={{ padding: 12 }}>{ctrl}</td>
                    <td style={{ padding: 12 }}>{subject}</td>
                    <td style={{ padding: 12 }}>{j.attempts}</td>
                    <td style={{ padding: 12 }}>
                      {j.error ? <Mono>{j.error}</Mono> : "—"}
                    </td>
                    <td style={{ padding: 12 }}>
                      {j.url ? (
                        <a
                          href={j.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: "none" }}
                          title={j.url}
                        >
                          <Mono>open</Mono>
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    {FLAG_WEBFORM_RETRY && (
                      <td style={{ padding: 12 }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <form action={actionRequeue}>
                            <input type="hidden" name="id" value={j.id} />
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
                          <form action={actionCancel}>
                            <input type="hidden" name="id" value={j.id} />
                            <input
                              type="hidden"
                              name="reason"
                              value="cancelled_by_operator"
                            />
                            <button
                              type="submit"
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid #b91c1c",
                                background: "#fff",
                                color: "#b91c1c",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                              title="Cancel (mark failed)"
                            >
                              Cancel
                            </button>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {jobs.length === 0 && (
                <tr>
                  <td
                    colSpan={FLAG_WEBFORM_RETRY ? 8 : 7}
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    No jobs (or filter too strict).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, color: "#6b7280", fontSize: 12 }}>
        Tip: use <Mono>/ops/webform/pulse</Mono> to kick the worker; check{" "}
        <Mono>/ops/dlq</Mono> for exhausted jobs.
      </div>
    </div>
  );
}
