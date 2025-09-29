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
      // If /api/exposure exists in your project (used previously in Coverage page), we show it here.
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
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border rounded-xl p-4">
              <div className="h-5 w-24 bg-gray-200 rounded mb-3 animate-pulse" />
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="border rounded-xl p-4">
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
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {typeof exposure === "number" ? <ExposurePill score={exposure} /> : null}
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          title="Requests"
          primary={requests.total}
          secondary={`${requests.open} open · ${requests.in_progress} in-progress · ${requests.resolved} resolved · ${requests.closed} closed`}
          href="/requests"
        />
        <Card
          title="Coverage Items"
          primary={coverage.total}
          secondary={`${coverage.open} open · ${coverage.in_progress} in-progress · ${coverage.resolved} resolved`}
          href="/coverage"
        />
        <Card title="Brokers" primary={brokers.total} secondary="" href="/brokers" />
      </section>

      {/* Activity */}
      <section className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Recent Activity</h2>
          <Link className="px-3 py-1 rounded border hover:bg-gray-50" href="/activity">
            View all
          </Link>
        </div>
        {activity.length === 0 ? (
          <div className="text-gray-600 text-sm">No activity yet.</div>
        ) : (
          <ul className="space-y-2">
            {activity.map((a) => (
              <li key={a.id} className="border rounded p-3 text-sm flex items-start justify-between">
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
  );
}

function Card({
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
    <Link href={href || "#"} className="border rounded-xl p-4 block hover:bg-gray-50">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-3xl font-semibold mt-1">{primary}</div>
      {secondary ? <div className="text-xs text-gray-500 mt-1">{secondary}</div> : null}
    </Link>
  );
}

function ExposurePill({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-red-100 text-red-700" :
    score >= 40 ? "bg-amber-100 text-amber-700" :
                  "bg-emerald-100 text-emerald-700";
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>
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
