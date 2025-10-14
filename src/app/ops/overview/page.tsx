// src/app/ops/overview/page.tsx
import Link from "next/link";

type WebformJob = {
  id: string;
  action_id: string | null;
  subject_id: string;
  url: string | null;
  status: "queued" | "running" | "succeeded" | "failed";
  attempt: number | null;
  scheduled_at: string | null;
  run_at: string | null;
  completed_at: string | null;
  result: any | null;
};

type WebformSummaryRes = {
  stats: { queued: number; running: number; succeeded: number; failed: number } | null;
  recent: WebformJob[];
};

type SlaItem = {
  controllerId: string | null;
  name: string;
  domain: string | null;
  total: number;
  ok: number;
  needsReview: number;
  sending: number;
  failed: number;
  okRate: number;
};

type SlaRes = { windowStart: string; controllers: SlaItem[] };

async function fetchJSON<T>(path: string, fallback: T): Promise<T> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!res.ok) return fallback;
  return (await res.json()) as T;
}

function fmt(dt?: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default async function OpsOverviewPage() {
  const [webforms, sla] = await Promise.all([
    fetchJSON<WebformSummaryRes>("/api/ops/webforms/summary", {
      stats: { queued: 0, running: 0, succeeded: 0, failed: 0 },
      recent: [],
    }),
    fetchJSON<SlaRes>("/api/ops/controllers/sla", {
      windowStart: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      controllers: [],
    }),
  ]);

  const stats = webforms.stats || { queued: 0, running: 0, succeeded: 0, failed: 0 };
  const recent = webforms.recent || [];
  const controllers = sla.controllers || [];

  return (
    <div className="p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Operations Overview</h1>
          <p className="text-sm text-gray-500">Unified health across automations & controllers</p>
        </div>
        <div className="flex gap-2">
          <Link href="/ops/webforms" className="px-3 py-2 rounded-xl border hover:bg-gray-50 text-sm">
            Webform Queue
          </Link>
          <Link href="/ops/controllers" className="px-3 py-2 rounded-xl border hover:bg-gray-50 text-sm">
            Controller SLA
          </Link>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Queued" value={stats.queued} tone="info" />
        <KPI label="Running" value={stats.running} tone="warn" />
        <KPI label="Succeeded" value={stats.succeeded} tone="ok" />
        <KPI label="Failed" value={stats.failed} tone="bad" />
      </section>

      {/* Controller SLA (worst first) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Controllers (last 30 days)</h2>
          <Link href="/ops/controllers" className="text-sm text-blue-600 hover:underline">
            View full SLA →
          </Link>
        </div>
        <div className="overflow-auto rounded-2xl border">
          <table className="min-w-[800px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3">Controller</th>
                <th className="text-left px-4 py-3">Domain</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">OK</th>
                <th className="text-right px-4 py-3">Needs Review</th>
                <th className="text-right px-4 py-3">Sending</th>
                <th className="text-right px-4 py-3">Failed</th>
                <th className="text-right px-4 py-3">OK Rate</th>
              </tr>
            </thead>
            <tbody>
              {controllers.map((c) => (
                <tr key={c.controllerId ?? `unknown-${c.name}`} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.controllerId ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3">{c.domain ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{c.total}</td>
                  <td className="px-4 py-3 text-right"><Badge tone="ok">{c.ok}</Badge></td>
                  <td className="px-4 py-3 text-right"><Badge tone="warn">{c.needsReview}</Badge></td>
                  <td className="px-4 py-3 text-right"><Badge tone="info">{c.sending}</Badge></td>
                  <td className="px-4 py-3 text-right"><Badge tone="bad">{c.failed}</Badge></td>
                  <td className="px-4 py-3 text-right"><Heat value={c.okRate} label={pct(c.okRate)} /></td>
                </tr>
              ))}
              {controllers.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No controller activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent webform jobs */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Webform Jobs</h2>
          <Link href="/ops/webforms" className="text-sm text-blue-600 hover:underline">
            Open queue →
          </Link>
        </div>
        <div className="overflow-auto rounded-2xl border">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3">Job ID</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">URL</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Attempt</th>
                <th className="text-left px-4 py-3">Scheduled</th>
                <th className="text-left px-4 py-3">Run</th>
                <th className="text-left px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((j) => (
                <tr key={j.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link href={`/ops/webforms/${j.id}`} className="text-blue-700 hover:underline">
                      {j.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{j.action_id ?? "—"}</td>
                  <td className="px-4 py-3">
                    {j.url ? (
                      <a href={j.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                        {j.url}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3"><StatusPill status={j.status} /></td>
                  <td className="px-4 py-3 text-right">{String(j.attempt ?? 0)}</td>
                  <td className="px-4 py-3">{fmt(j.scheduled_at)}</td>
                  <td className="px-4 py-3">{fmt(j.run_at)}</td>
                  <td className="px-4 py-3">{fmt(j.completed_at)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">Queue is empty.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: number | string; tone: "ok" | "warn" | "bad" | "info" }) {
  const ring =
    tone === "ok" ? "ring-emerald-200"
    : tone === "warn" ? "ring-amber-200"
    : tone === "info" ? "ring-sky-200"
    : "ring-rose-200";
  return (
    <div className={`rounded-2xl border p-4 ring-4 ${ring}`}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" | "bad" | "info" }) {
  const klass =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700"
      : tone === "info"
      ? "bg-sky-50 text-sky-700"
      : "bg-rose-50 text-rose-700";
  return <span className={`px-2 py-1 rounded-full text-xs ${klass}`}>{children}</span>;
}

function Heat({ value, label }: { value: number; label: string }) {
  const g = Math.round(value * 255);
  const r = 255 - g;
  const bg = `rgba(${r}, ${g}, 80, 0.12)`;
  const fg = `rgb(${r}, ${g}, 80)`;
  return <span className="px-2 py-1 rounded-full text-xs" style={{ backgroundColor: bg, color: fg }}>{label}</span>;
}

function StatusPill({ status }: { status: WebformJob["status"] }) {
  const tone =
    status === "succeeded" ? "ok"
    : status === "running" ? "info"
    : status === "queued" ? "warn"
    : "bad";
  return <Badge tone={tone as any}>{status}</Badge>;
}
