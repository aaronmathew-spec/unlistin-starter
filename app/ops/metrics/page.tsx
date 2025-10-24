// app/ops/metrics/page.tsx
import { listDispatchLog } from "@/lib/dispatch/query";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listDispatchLog>>[number];

function pct(n: number, d: number) {
  if (!d) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "white",
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 800, fontSize: 24 }}>{value}</div>
      {sub ? (
        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>{sub}</div>
      ) : null}
    </div>
  );
}

function Table({
  rows,
  title,
  columns,
}: {
  rows: Array<Record<string, string | number>>;
  title: string;
  columns: Array<{ key: string; label: string; mono?: boolean }>;
}) {
  return (
    <div
      style={{
        marginTop: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
        background: "white",
      }}
    >
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb",
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 720,
            borderCollapse: "separate",
            borderSpacing: 0,
          }}
        >
          <thead style={{ textAlign: "left", background: "#fafafa" }}>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ padding: 12, fontSize: 12, color: "#6b7280" }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{
                        padding: 12,
                        fontFamily: c.mono
                          ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                          : undefined,
                      }}
                    >
                      {r[c.key] as any}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "#6b7280",
                  }}
                >
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function OpsMetricsPage() {
  // Pull a recent window (adjust if you prefer)
  let rows: Row[] = [];
  try {
    rows = await listDispatchLog(1000);
  } catch {
    rows = [];
  }

  // Basic rollups
  const total = rows.length;
  const ok = rows.filter((r) => !!r.ok).length;
  const err = total - ok;

  // By channel
  const perChan = new Map<string, { total: number; ok: number }>();
  for (const r of rows) {
    const k = r.channel || "unknown";
    const slot = perChan.get(k) || { total: 0, ok: 0 };
    slot.total += 1;
    if (r.ok) slot.ok += 1;
    perChan.set(k, slot);
  }
  const byChannel = Array.from(perChan.entries())
    .map(([channel, s]) => ({
      channel,
      total: s.total,
      ok: s.ok,
      fail: s.total - s.ok,
      successRate: pct(s.ok, s.total),
    }))
    .sort((a, b) => b.total - a.total);

  // By controller
  const perCtrl = new Map<string, { total: number; ok: number }>();
  for (const r of rows) {
    const k = r.controller_key || "unknown";
    const slot = perCtrl.get(k) || { total: 0, ok: 0 };
    slot.total += 1;
    if (r.ok) slot.ok += 1;
    perCtrl.set(k, slot);
  }
  const byController = Array.from(perCtrl.entries())
    .map(([controller, s]) => ({
      controller,
      total: s.total,
      ok: s.ok,
      fail: s.total - s.ok,
      successRate: pct(s.ok, s.total),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);

  // Recent errors (last 50)
  const recentErrors = rows
    .filter((r) => !r.ok)
    .slice(0, 50)
    .map((r) => ({
      when: new Date(r.created_at).toLocaleString(),
      controller: r.controller_key || "-",
      channel: r.channel || "-",
      providerId: r.provider_id || "-",
      error: (r.error || r.note || "-") ?? "-",
    }));

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Ops · Metrics</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Golden signals over recent dispatches. Data comes from{" "}
            <code>listDispatchLog()</code>; no schema changes required.
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
          }}
        >
          ← Back to Dispatch
        </a>
      </div>

      {/* Topline */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 16,
        }}
      >
        <Stat label="Total dispatches (recent)" value={total} />
        <Stat label="Succeeded" value={ok} sub={pct(ok, total)} />
        <Stat label="Failed" value={err} sub={pct(err, total)} />
      </div>

      {/* By channel */}
      <Table
        title="By Channel"
        columns={[
          { key: "channel", label: "Channel" },
          { key: "total", label: "Total" },
          { key: "ok", label: "OK" },
          { key: "fail", label: "Fail" },
          { key: "successRate", label: "Success rate" },
        ]}
        rows={byChannel}
      />

      {/* By controller */}
      <Table
        title="Top Controllers (by volume)"
        columns={[
          { key: "controller", label: "Controller" },
          { key: "total", label: "Total" },
          { key: "ok", label: "OK" },
          { key: "fail", label: "Fail" },
          { key: "successRate", label: "Success rate" },
        ]}
        rows={byController}
      />

      {/* Recent errors */}
      <Table
        title="Recent Errors"
        columns={[
          { key: "when", label: "When" },
          { key: "controller", label: "Controller" },
          { key: "channel", label: "Channel" },
          { key: "providerId", label: "Provider ID", mono: true },
          { key: "error", label: "Error" },
        ]}
        rows={recentErrors}
      />
    </div>
  );
}
