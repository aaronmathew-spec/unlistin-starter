/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, ShieldCheck, Timer, Bell } from "lucide-react";

async function getData() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  const res = await fetch(`${base}/api/dashboard`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as any;
}

export default async function DashboardPage() {
  const data = await getData();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-white">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-neutral-300">Your privacy status at a glance</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          title="Exposures Detected"
          value={fmt(data?.kpis?.exposure)}
          icon={<ShieldCheck className="w-5 h-5" />}
          hint="Total items we’re working on"
        />
        <KpiCard
          title="Prepared"
          value={fmt(data?.kpis?.prepared)}
          icon={<Timer className="w-5 h-5" />}
          hint="Drafted & queued"
        />
        <KpiCard
          title="In Flight"
          value={fmt(data?.kpis?.sent)}
          icon={<ArrowUpRight className="w-5 h-5" />}
          hint="Requests sent to brokers"
        />
        <KpiCard
          title="Needs You"
          value={fmt(data?.kpis?.needsUser)}
          icon={<Bell className="w-5 h-5" />}
          hint="We’ll nudge you only when needed"
          accent
        />
      </section>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-medium">14-Day Progress</h2>
              <span className="text-xs text-neutral-400">Prepared vs Completed</span>
            </div>
            <TrendChart data={data?.trend || []} />
          </div>
        </div>
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
            <h3 className="text-base font-medium mb-3">Needs Your Attention</h3>
            <ul className="space-y-3">
              {(data?.needs || []).map((n: any) => (
                <li key={n.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{n.broker}</p>
                    <p className="text-xs text-neutral-400">{new Date(n.since).toLocaleString()}</p>
                  </div>
                  <a
                    href={`/requests/${n.id}`}
                    className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                  >
                    Review
                  </a>
                </li>
              ))}
              {(!data?.needs || data.needs.length === 0) && (
                <p className="text-sm text-neutral-400">All clear for now ✨</p>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
            <h3 className="text-base font-medium mb-3">Recent Activity</h3>
            <ul className="space-y-2">
              {(data?.recent || []).map((r: any) => (
                <li key={r.id} className="text-sm flex items-center justify-between">
                  <span className="truncate">{r.broker} • {r.status}</span>
                  <span className="text-xs text-neutral-400">{new Date(r.at).toLocaleString()}</span>
                </li>
              ))}
              {(!data?.recent || data.recent.length === 0) && (
                <p className="text-sm text-neutral-400">No recent events.</p>
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
  icon,
  accent,
}: {
  title: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-emerald-700/40 bg-emerald-900/10" : "border-neutral-800 bg-neutral-900/50"}`}>
      <div className="flex items-center gap-2 text-neutral-300">
        <span className="text-neutral-200">{icon}</span>
        <span className="text-sm">{title}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-400">{hint}</div>}
    </div>
  );
}

function fmt(n?: number) {
  if (typeof n !== "number") return "0";
  return n.toLocaleString();
}

// Client chart (recharts) loaded dynamically
const TrendChart = dynamic(() => import("./trend-client").then(m => m.TrendClient), { ssr: false });
