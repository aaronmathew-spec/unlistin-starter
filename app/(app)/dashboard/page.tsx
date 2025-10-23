// app/(app)/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [exposure, setExposure] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    const [dashRes, expRes] = await Promise.allSettled([
      fetch("/api/dashboard", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/exposure").then((r) => (r.ok ? r.json() : { score: null })),
    ]);

    if (dashRes.status === "fulfilled" && dashRes.value) {
      setData(dashRes.value as DashboardResponse);
    } else {
      setData({
        requests: { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 },
        coverage: { total: 0, open: 0, in_progress: 0, resolved: 0 },
        brokers: { total: 0 },
        activity: [],
      });
    }

    if (expRes.status === "fulfilled" && typeof expRes.value?.score === "number") {
      setExposure(Math.round(expRes.value.score));
    } else {
      setExposure(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    const d = data;
    if (!d) return [];
    return [
      {
        title: "Requests",
        primary: d.requests.total,
        sub: `${d.requests.open} open · ${d.requests.in_progress} in-progress · ${d.requests.resolved} resolved · ${d.requests.closed} closed`,
        href: "/requests",
      },
      {
        title: "Coverage Items",
        primary: d.coverage.total,
        sub: `${d.coverage.open} open · ${d.coverage.in_progress} in-progress · ${d.coverage.resolved} resolved`,
        href: "/coverage",
      },
      {
        title: "Brokers",
        primary: d.brokers.total,
        sub: "",
        href: "/brokers",
      },
    ];
  }, [data]);

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[color:var(--muted)]">Ops Console</div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        {typeof exposure === "number" ? <ExposurePill score={exposure} /> : null}
      </div>

      {/* At-a-glance KPIs */}
      <section className="rounded-3xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
        <div className="text-sm font-medium">At a glance</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(metrics ?? []).map((m) =>
            loading ? (
              <div key={m.title} className="rounded-xl border border-[var(--card-border)] bg-[var(--accent)] p-4">
                <div className="h-4 w-24 animate-pulse rounded bg-neutral-700/30 mb-2" />
                <div className="h-7 w-16 animate-pulse rounded bg-neutral-700/20" />
                <div className="mt-2 h-3 w-40 animate-pulse rounded bg-neutral-700/10" />
              </div>
            ) : (
              <Link
                key={m.title}
                href={m.href}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--accent)] p-4 hover:bg-[var(--card)] transition-colors"
              >
                <div className="text-xs text-[color:var(--muted)]">{m.title}</div>
                <div className="mt-1 text-2xl font-semibold">{m.primary}</div>
                {m.sub ? <div className="mt-1 text-[11px] leading-4 text-[color:var(--muted)]">{m.sub}</div> : null}
              </Link>
            )
          )}
        </div>
      </section>

      {/* Activity */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Recent Activity</h3>
          <Link className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-sm hover:bg-[var(--accent)]" href="/activity">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
                <div className="h-4 w-48 animate-pulse rounded bg-neutral-700/30 mb-2" />
                <div className="h-3 w-72 animate-pulse rounded bg-neutral-700/20" />
              </div>
            ))}
          </div>
        ) : data && data.activity.length > 0 ? (
          <ul className="space-y-2">
            {data.activity.map((a) => (
              <li key={a.id} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-sm flex items-start justify-between">
                <div className="pr-4">
                  <div className="font-medium">
                    {prettyEntity(a.entity_type)} #{a.entity_id} — {prettyAction(a.action)}
                  </div>
                  {a.meta ? (
                    <pre className="mt-1 text-xs text-[color:var(--muted)] whitespace-pre-wrap break-words">
                      {JSON.stringify(a.meta, null, 2)}
                    </pre>
                  ) : null}
                </div>
                <div className="text-xs text-[color:var(--muted)] whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-sm text-[color:var(--muted)]">
            No activity yet. After you run scans and create requests, you’ll see events here.
          </div>
        )}
      </section>
    </div>
  );
}

/* Utils */
function ExposurePill({ score }: { score: number }) {
  const tone =
    score >= 75 ? "bg-red-500/15 text-red-300 border-red-500/30" :
    score >= 40 ? "bg-amber-500/15 text-amber-300 border-amber-500/30" :
                  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  return <span className={`px-3 py-1 rounded-full text-sm font-medium border ${tone}`}>Exposure: {score}</span>;
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
