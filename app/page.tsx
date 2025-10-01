// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Act = {
  id: number;
  entity_type: "request" | "coverage" | "broker" | "file";
  entity_id: number;
  action: "create" | "update" | "status" | "delete" | "upload" | "download";
  meta: Record<string, unknown> | null;
  created_at: string;
};

type DashboardResponse = {
  requests: { total: number; open: number; in_progress: number; resolved: number; closed: number };
  coverage: { total: number; open: number; in_progress: number; resolved: number };
  brokers: { total: number };
  activity: Act[];
};

export default function HomePage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [exposure, setExposure] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [dashRes, expRes] = await Promise.all([
      fetch("/api/dashboard", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/exposure").then((r) => (r.ok ? r.json() : { score: null })).catch(() => ({ score: null })),
    ]);
    setData(dashRes);
    setExposure(typeof expRes.score === "number" ? Math.round(expRes.score) : null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading || !data) {
    return (
      <div className="p-6 mx-auto max-w-7xl space-y-6">
        {/* Luxury hero skeleton */}
        <div className="relative overflow-hidden rounded-3xl border bg-white p-6">
          <div className="absolute inset-0 -z-10 opacity-30 blur-2xl"
               style={{ background: "linear-gradient(90deg,#A78BFA,#60A5FA,#34D399)" }} />
          <div className="h-6 w-72 bg-gray-200 rounded mb-2 animate-pulse" />
          <div className="h-4 w-96 bg-gray-200 rounded mb-4 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-10 w-40 bg-gray-200 rounded-xl animate-pulse" />
            <div className="h-10 w-48 bg-gray-200 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* KPI skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border rounded-2xl p-5">
              <div className="h-5 w-24 bg-gray-200 rounded mb-3 animate-pulse" />
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>

        <div className="border rounded-2xl p-5">
          <div className="h-5 w-40 bg-gray-200 rounded mb-3 animate-pulse" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { requests, coverage, brokers, activity } = data;

  return (
    <main className="relative min-h-screen">
      {/* Soft luxury background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_-10%,rgba(99,102,241,.15),rgba(255,255,255,0))]" />
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full blur-3xl opacity-25"
             style={{ background: "linear-gradient(90deg,#A78BFA,#60A5FA,#34D399)" }} />
      </div>

      <div className="p-6 mx-auto max-w-7xl space-y-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border bg-white p-6 md:p-8">
          <div className="absolute right-[-140px] top-[-120px] h-[360px] w-[360px] rounded-full blur-3xl opacity-20"
               style={{ background: "linear-gradient(45deg,#F472B6,#A78BFA)" }} />
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> India-first data removal
              </div>
              <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
                Erase your personal data, privately.{" "}
                <span className="bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 bg-clip-text text-transparent">
                  Fast. Secure. AI-assisted.
                </span>
              </h1>
              <p className="mt-2 text-sm md:text-base text-neutral-600">
                Unlistin scans people-search and business directories, produces redacted evidence, and helps you file removals—
                without storing your Quick Scan inputs.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link href="/scan/quick" className="rounded-xl bg-black px-5 py-3 text-sm font-medium text-white hover:opacity-90">
                  Start Free Quick Scan
                </Link>
                <Link href="/ti" className="rounded-xl border px-5 py-3 text-sm hover:bg-neutral-50">
                  Run Threat-Intel Preview
                </Link>
                <Link href="/ai" className="rounded-xl border px-5 py-3 text-sm hover:bg-neutral-50">
                  Talk to AI Concierge
                </Link>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-500">
                <span>• No persistent PII</span>
                <span>• Strict allowlist</span>
                <span>• RLS & CSP enforced</span>
              </div>
            </div>

            {/* Visual mini-card */}
            <div className="w-full max-w-md">
              <div className="rounded-2xl border bg-white shadow-[0_10px_40px_rgba(0,0,0,.06)] p-4">
                <div className="flex items-center justify-between border-b px-2 py-2">
                  <div className="text-sm font-medium">Quick Scan</div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Private</span>
                </div>
                <div className="grid gap-3 p-3">
                  <input placeholder="name@example.com" className="w-full rounded-lg border px-3 py-2 text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Name (optional)" className="w-full rounded-lg border px-3 py-2 text-sm" />
                    <input placeholder="City (optional)" className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                  <Link href="/scan/quick" className="inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm text-white">
                    Run on Secure Server
                  </Link>
                </div>
                {/* tiny faux results */}
                <div className="grid gap-2 p-3 pt-0 sm:grid-cols-3">
                  {[
                    { title: "Justdial", score: 0.82 },
                    { title: "Sulekha", score: 0.74 },
                    { title: "IndiaMART", score: 0.68 },
                  ].map((x) => (
                    <div key={x.title} className="rounded-lg border bg-white p-2">
                      <div className="text-[11px] text-neutral-500">Possible match</div>
                      <div className="mt-0.5 text-sm font-medium">{x.title}</div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-100">
                        <div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
                             style={{ width: `${Math.round(x.score * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Header row with exposure */}
        <header className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Dashboard</h2>
          {typeof exposure === "number" ? <ExposurePill score={exposure} /> : null}
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            title="Requests"
            primary={requests.total}
            secondary={`${requests.open} open · ${requests.in_progress} in-progress · ${requests.resolved} resolved · ${requests.closed} closed`}
            href="/requests"
          />
          <KpiCard
            title="Coverage Items"
            primary={coverage.total}
            secondary={`${coverage.open} open · ${coverage.in_progress} in-progress · ${coverage.resolved} resolved`}
            href="/coverage"
          />
          <KpiCard title="Brokers" primary={brokers.total} secondary="" href="/brokers" />
        </section>

        {/* Empty state helper */}
        {requests.total === 0 && (
          <div className="border rounded-2xl p-4 flex items-center justify-between bg-neutral-50">
            <div className="text-sm text-gray-700">No requests yet — create your first request to get started.</div>
            <Link href="/requests" className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm">
              Create a Request
            </Link>
          </div>
        )}

        {/* Activity */}
        <section className="border rounded-2xl p-5 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Recent Activity</h3>
            <div className="flex gap-2">
              <Link className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm" href="/activity">View all</Link>
              <Link className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm" href="/billing">Billing</Link>
              <Link className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm" href="/admin">Admin</Link>
            </div>
          </div>
          {activity.length === 0 ? (
            <div className="text-gray-600 text-sm">No activity yet.</div>
          ) : (
            <ul className="space-y-2">
              {activity.map((a) => (
                <li key={a.id} className="border rounded-lg p-3 text-sm flex items-start justify-between hover:bg-neutral-50">
                  <div className="pr-4">
                    <div className="font-medium">
                      {prettyEntity(a.entity_type)} #{a.entity_id} — {prettyAction(a.action)}
                    </div>
                    {a.meta ? (
                      <pre className="mt-1 text-xs text-gray-600 whitespace-pre-wrap break-words">
                        {JSON.stringify(a.meta, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function KpiCard({
  title,
  primary,
  secondary,
  href,
}: {
  title: string;
  primary: number | string;
  secondary?: string;
  href?: string;
}) {
  return (
    <Link href={href || "#"} className="block rounded-2xl border bg-white p-5 hover:shadow-sm transition">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-3xl font-semibold mt-1">{primary}</div>
      {secondary ? <div className="text-xs text-gray-500 mt-1">{secondary}</div> : null}
    </Link>
  );
}

function ExposurePill({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-red-100 text-red-700 border-red-200" :
    score >= 40 ? "bg-amber-100 text-amber-700 border-amber-200" :
                  "bg-emerald-100 text-emerald-700 border-emerald-200";
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${color}`}>
      Exposure: {score}
    </span>
  );
}

function prettyEntity(t: Act["entity_type"]) {
  switch (t) {
    case "request": return "Request";
    case "coverage": return "Coverage";
    case "broker": return "Broker";
    case "file": return "File";
  }
}
function prettyAction(a: Act["action"]) {
  switch (a) {
    case "create": return "Created";
    case "update": return "Updated";
    case "status": return "Status Changed";
    case "delete": return "Deleted";
    case "upload": return "Uploaded";
    case "download": return "Downloaded";
  }
}
