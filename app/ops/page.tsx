// app/ops/page.tsx
// Lightweight Ops overview: quick counters and navigation.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/src/lib/supabase/admin";

const JOBS_TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";

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

async function getCounts() {
  const s = supabaseAdmin();

  // Total
  const totalQ = await s
    .from(JOBS_TABLE)
    .select("*", { count: "exact", head: true });
  const total = totalQ.count ?? 0;

  async function countByStatus(status: "queued" | "running" | "succeeded" | "failed") {
    const q = await s
      .from(JOBS_TABLE)
      .select("*", { count: "exact", head: true })
      .eq("status", status);
    return q.count ?? 0;
    }

  // Basic status counts
  const [queued, running, succeeded, failed] = await Promise.all([
    countByStatus("queued"),
    countByStatus("running"),
    countByStatus("succeeded"),
    countByStatus("failed"),
  ]);

  // DLQ count
  const dlqQ = await s.from("ops_dlq").select("*", { count: "exact", head: true });
  const dlq = dlqQ.count ?? 0;

  // Last 24h processed
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const last24Q = await s
    .from(JOBS_TABLE)
    .select("*", { count: "exact", head: true })
    .gte("finished_at", since)
    .eq("status", "succeeded");
  const last24 = last24Q.count ?? 0;

  return { total, queued, running, succeeded, failed, dlq, last24 };
}

export default async function OpsHome() {
  const c = await getCounts();

  const cards: Array<{ label: string; value: number; href?: string }> = [
    { label: "Total Jobs", value: c.total, href: "/ops/webform/queue" },
    { label: "Queued", value: c.queued, href: "/ops/webform/queue?status=queued" },
    { label: "Running", value: c.running, href: "/ops/webform/queue?status=running" },
    { label: "Succeeded", value: c.succeeded, href: "/ops/webform/queue?status=succeeded" },
    { label: "Failed", value: c.failed, href: "/ops/webform/queue?status=failed" },
    { label: "DLQ", value: c.dlq, href: "/ops/dlq" },
    { label: "Succeeded (24h)", value: c.last24, href: "/ops/webform/queue?status=succeeded" },
  ];

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
          <h1 style={{ margin: 0 }}>Ops · Overview</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            One glance view of queues and DLQ. Use <a href="/ops/webform/queue">Queue</a> to inspect jobs or{" "}
            <a href="/ops/dlq">DLQ</a> to retry failures.
          </p>
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
            title="Run a single worker pass"
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
            title="Open queue"
          >
            📋 Queue
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
            title="Open DLQ"
          >
            🧰 DLQ
          </a>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {cards.map((k) => (
          <a
            key={k.label}
            href={k.href}
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              background: "#fff",
              borderRadius: 12,
              padding: 16,
              display: "block",
            }}
          >
            <div style={{ color: "#6b7280", fontSize: 12 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{k.value}</div>
          </a>
        ))}
      </div>

      <div style={{ marginTop: 16, color: "#6b7280", fontSize: 12 }}>
        CSV export requires <Mono>FLAG_WEBFORM_EXPORT=1</Mono> (or <Mono>x-secure-cron</Mono> header). DLQ export
        controlled by <Mono>FLAG_DLQ_EXPORT=1</Mono>.
      </div>
    </div>
  );
}
