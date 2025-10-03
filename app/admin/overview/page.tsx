/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import dynamic from "next/dynamic";

async function getData() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  const res = await fetch(`${base}/api/admin/overview`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as any;
}

export default async function AdminOverviewPage() {
  const data = await getData();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-white">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Admin Overview</h1>
        <p className="text-sm text-neutral-300">Full visibility across adapters and actions</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Kpi title="Prepared" value={fmt(data?.totals?.prepared)} />
        <Kpi title="Sent" value={fmt(data?.totals?.sent)} />
        <Kpi title="Completed" value={fmt(data?.totals?.completed)} />
        <Kpi title="Needs User" value={fmt(data?.totals?.needs_user)} />
        <Kpi title="Failed" value={fmt(data?.totals?.failed)} />
      </section>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-medium">Adapters (14-day)</h2>
          </div>
          <AdapterTable rows={data?.adapters || []} />
        </div>

        <div className="lg:col-span-1 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-base font-medium mb-3">Controls</h2>
          <ul className="space-y-2">
            {(data?.controls || []).map((c: any) => (
              <li key={c.adapter} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="truncate">{c.adapter}</p>
                  <p className="text-xs text-neutral-400">
                    {c.killed ? "Killed" : "Active"} • cap(prep): {c.cap_prepare ?? "∞"} • cap(sent): {c.cap_sent ?? "∞"} • min: {c.min_conf ?? "—"}
                  </p>
                </div>
                <a href="/admin/adapters" className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Edit</a>
              </li>
            ))}
            {(!data?.controls || data.controls.length === 0) && <p className="text-sm text-neutral-400">No controls found.</p>}
          </ul>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">Recent Actions</h2>
        </div>
        <RecentTable rows={data?.recent || []} />
      </section>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-sm text-neutral-300">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function fmt(n?: number) {
  if (typeof n !== "number") return "0";
  return n.toLocaleString();
}

function AdapterTable({ rows }: { rows: Array<{ adapter: string; prepared: number; sent: number; completed: number; failed: number }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-neutral-300">
          <tr>
            <th className="py-2 pr-4">Adapter</th>
            <th className="py-2 pr-4">Prepared</th>
            <th className="py-2 pr-4">Sent</th>
            <th className="py-2 pr-4">Completed</th>
            <th className="py-2 pr-4">Failed</th>
          </tr>
        </thead>
        <tbody className="text-neutral-100">
          {rows.map((r) => (
            <tr key={r.adapter} className="border-t border-neutral-800">
              <td className="py-2 pr-4">{r.adapter}</td>
              <td className="py-2 pr-4">{r.prepared}</td>
              <td className="py-2 pr-4">{r.sent}</td>
              <td className="py-2 pr-4">{r.completed}</td>
              <td className="py-2 pr-4">{r.failed}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="py-4 text-neutral-400" colSpan={5}>No data.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RecentTable({ rows }: { rows: Array<{ id: number; adapter: string; broker: string; category: string; status: string; confidence: number | null; at: string }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-neutral-300">
          <tr>
            <th className="py-2 pr-4">ID</th>
            <th className="py-2 pr-4">Adapter</th>
            <th className="py-2 pr-4">Broker</th>
            <th className="py-2 pr-4">Category</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Conf.</th>
            <th className="py-2 pr-4">At</th>
          </tr>
        </thead>
        <tbody className="text-neutral-100">
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-neutral-800">
              <td className="py-2 pr-4">{r.id}</td>
              <td className="py-2 pr-4">{r.adapter}</td>
              <td className="py-2 pr-4">{r.broker}</td>
              <td className="py-2 pr-4">{r.category}</td>
              <td className="py-2 pr-4">{r.status}</td>
              <td className="py-2 pr-4">{r.confidence ?? "—"}</td>
              <td className="py-2 pr-4">{new Date(r.at).toLocaleString()}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="py-4 text-neutral-400" colSpan={7}>No recent actions.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// (Optional future) dynamic charts
const _Placeholder = dynamic(async () => (() => null), { ssr: false });
