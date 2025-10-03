/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import dynamic from "next/dynamic";

async function getAdminData() {
  // Works whether the route is public or behind auth—returns null on 401/404.
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  try {
    const res = await fetch(`${base}/api/admin/overview`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as any;
  } catch {
    return null;
  }
}

export default async function AdminOverviewPage() {
  const data = await getAdminData();

  const totals = {
    users: num(data?.totals?.users),
    workspaces: num(data?.totals?.workspaces),
    scansToday: num(data?.totals?.scans_today),
    actionsQueued: num(data?.totals?.actions_prepared),
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 text-white">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Admin • Overview</h1>
        <p className="text-sm text-neutral-300">
          System-wide visibility. Customer dashboards remain minimal and elegant.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi title="Users" value={fmt(totals.users)} hint="Total active users" />
        <Kpi title="Workspaces" value={fmt(totals.workspaces)} hint="Enterprise & teams" />
        <Kpi title="Scans (24h)" value={fmt(totals.scansToday)} hint="Quick + Deep" />
        <Kpi title="Actions queued" value={fmt(totals.actionsQueued)} hint="Prepared requests" />
      </section>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Throughput (14 days)" subtitle="Prepared • Sent • Completed">
            <TrendChart data={Array.isArray(data?.trend) ? data.trend : []} />
          </Card>
        </div>
        <div className="lg:col-span-1 space-y-6">
          <Card title="Top Adapters" subtitle="By volume (7d)">
            <ul className="space-y-2">
              {Array.isArray(data?.top_adapters) && data.top_adapters.length > 0 ? (
                data.top_adapters.map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{a.id}</span>
                    <span className="text-neutral-300">{fmt(a.count)}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-neutral-400">No data</li>
              )}
            </ul>
          </Card>

          <Card title="Error Buckets" subtitle="Last 24h">
            <ul className="space-y-2">
              {Array.isArray(data?.errors) && data.errors.length > 0 ? (
                data.errors.map((e: any, i: number) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate">{e.kind}</span>
                    <span className="text-red-300">{fmt(e.count)}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-neutral-400">No recent errors</li>
              )}
            </ul>
          </Card>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recent Actions" subtitle="System-wide (redacted)">
          <ul className="space-y-2">
            {Array.isArray(data?.recent) && data.recent.length > 0 ? (
              data.recent.map((r: any) => (
                <li key={r.id} className="text-sm flex items-center justify-between">
                  <span className="truncate">{r.broker || "Unknown"} • {r.status}</span>
                  <time className="text-xs text-neutral-400">
                    {new Date(r.at).toLocaleString()}
                  </time>
                </li>
              ))
            ) : (
              <li className="text-sm text-neutral-400">No recent events</li>
            )}
          </ul>
        </Card>

        <Card title="Queue Health" subtitle="Latency & backlog (mins)">
          <QueueBars data={Array.isArray(data?.queue) ? data.queue : []} />
        </Card>
      </section>
    </div>
  );
}

function Kpi({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-sm text-neutral-300">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-400">{hint}</div>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="mb-3">
        <h3 className="text-base font-medium">{title}</h3>
        {subtitle && <p className="text-xs text-neutral-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function num(v: unknown) {
  const n = typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}
function fmt(n?: number) {
  if (typeof n !== "number") return "0";
  return n.toLocaleString();
}

// Dynamic, client-only tiny SVG chart (no deps)
const TrendChart = dynamic(() => import("./trend-client").then(m => m.TrendClientAdmin), { ssr: false });

function QueueBars({ data }: { data: Array<{ name: string; backlog: number; latency_min: number }> }) {
  const items = Array.isArray(data) ? data.slice(0, 6) : [];
  const max = Math.max(1, ...items.map(i => Math.max(i.backlog || 0, i.latency_min || 0)));
  return (
    <div className="space-y-2">
      {items.length === 0 && <div className="text-sm text-neutral-400">All quiet.</div>}
      {items.map((i, idx) => (
        <div key={idx} className="text-sm">
          <div className="flex items-center justify-between">
            <span className="truncate">{i.name}</span>
            <span className="text-xs text-neutral-400">{i.backlog} in queue</span>
          </div>
          <div className="mt-1 h-2 rounded bg-neutral-800 overflow-hidden">
            <div
              className="h-2 bg-emerald-500/70"
              style={{ width: `${(100 * (i.backlog || 0)) / max}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-neutral-400">Latency ~ {i.latency_min}m</div>
        </div>
      ))}
    </div>
  );
}
