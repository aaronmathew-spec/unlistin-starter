// app/ops/overview/page.tsx
import { loadOverview } from "@/lib/ops/overview";

export const dynamic = "force-dynamic";

function Card({
  title,
  value,
  sub,
}: {
  title: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        minWidth: 220,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 28, fontWeight: 800 }}>{value}</div>
      {sub ? (
        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>{sub}</div>
      ) : null}
    </div>
  );
}

export default async function OpsOverviewPage() {
  const stats = await loadOverview();

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Ops · Overview</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Quick health of dispatch, DLQ, and verification backlog. Safe to open for on-call.
          </p>
        </div>
        <a
          href="/ops/dispatch"
          style={{
            textDecoration: "none",
            border: "1px solid #e5e7eb",
            padding: "8px 12px",
            borderRadius: 8,
            fontWeight: 600,
            background: "#fff",
          }}
        >
          Dispatch Console →
        </a>
      </header>

      {/* Dispatch row */}
      <section style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 8px 0" }}>Dispatch</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Card title="Today (all)" value={stats.dispatch_today} />
          <Card
            title="Last 24h OK"
            value={stats.dispatch_24h_ok}
            sub={stats.dispatch_24h_err ? `${stats.dispatch_24h_err} errors` : "0 errors"}
          />
          <a
            href="/ops/dlq"
            style={{ textDecoration: "none", color: "inherit" }}
            title="Open DLQ"
          >
            <Card title="DLQ" value={stats.dlq_count} sub="dead-lettered items" />
          </a>
        </div>
      </section>

      {/* Verification row */}
      <section style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 8px 0" }}>Verification</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Card title="Total" value={stats.verif_total} />
          <Card title="Pending" value={stats.verif_pending} />
          <Card title="Due for recheck" value={stats.verif_due} />
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          Tip: The alert email links here. Configure{" "}
          <code>ADMIN_EMAILS</code> and schedule your Vercel Cron for{" "}
          <code>/api/ops/verify/alert</code> and{" "}
          <code>/api/ops/verify/recheck</code> with the <code>x-secure-cron</code> header.
        </div>
      </section>
    </div>
  );
}
