// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import TrendClient from "./trend-client";

type TrendPoint = { date: string; prepared: number; completed: number };
type Summary = {
  exposure: number;
  prepared: number;
  sent: number;
  completed: number;
  trend: TrendPoint[];
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/dashboard", { cache: "no-store" });
        const j = await r.json();
        if (alive) setSummary(j);
      } catch {
        // swallow
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6">Loading…</div>;
  }

  if (!summary) {
    return <div className="p-6 text-red-500">Couldn’t load dashboard.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Exposure", value: summary.exposure },
          { label: "Prepared", value: summary.prepared },
          { label: "Sent", value: summary.sent },
          { label: "Completed", value: summary.completed },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl shadow-sm p-5 bg-white">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="text-2xl font-semibold mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="rounded-2xl shadow-sm p-5 bg-white">
        <div className="text-sm text-gray-500 mb-3">14-day Trend</div>
        <TrendClient data={summary.trend} />
      </div>
    </div>
  );
}
