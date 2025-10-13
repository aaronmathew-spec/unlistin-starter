// src/app/ops/webforms/page.tsx
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server component: relies on RLS + session cookie for user scoping
export default async function WebformOpsPage() {
  const db = createClient(url, anon, { auth: { persistSession: false } });

  // Fetch through API (ensures the same auth path), or query directly
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/ops/webforms/summary`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Webform Queue</h1>
        <p className="text-red-600 mt-2">Failed to load summary: {res.statusText}</p>
      </div>
    );
  }
  const data = await res.json();

  const stats = data.stats || { queued: 0, running: 0, succeeded: 0, failed: 0 };
  const recent = (data.recent || []) as Array<any>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Webform Queue</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to app
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Queued" value={stats.queued} />
        <StatCard label="Running" value={stats.running} />
        <StatCard label="Succeeded (total)" value={stats.succeeded} />
        <StatCard label="Failed (total)" value={stats.failed} />
      </div>

      <div className="mt-2 border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h2 className="font-medium">Recent Jobs</h2>
        </div>
        <div className="divide-y">
          {recent.length === 0 && (
            <div className="p-4 text-sm text-gray-500">No jobs yet.</div>
          )}
          {recent.map((j) => (
            <div key={j.id} className="p-4 flex items-start gap-4">
              <div className="min-w-[110px]">
                <StatusPill status={j.status} />
                <div className="text-xs text-gray-500 mt-1">
                  attempts: {j.attempt ?? 0}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-sm break-all">{j.url}</div>
                <div className="text-xs text-gray-500 mt-1">
                  scheduled: {fmt(j.scheduled_at)} {j.run_at ? `• run: ${fmt(j.run_at)}` : ""}{" "}
                  {j.completed_at ? `• done: ${fmt(j.completed_at)}` : ""}
                </div>
                {j.result?.confirmationText && (
                  <div className="text-xs text-gray-700 mt-2 line-clamp-3">
                    {j.result.confirmationText}
                  </div>
                )}
                {j.result?.error && (
                  <div className="text-xs text-red-600 mt-2">
                    error: {j.result.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Tip: configure cron for <code>/api/cron/webform</code> (with <code>x-cron-secret</code>) to keep this flowing.
      </div>
    </div>
  );
}

function fmt(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString();
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-2xl p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value ?? 0}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: "bg-yellow-100 text-yellow-800 border-yellow-200",
    running: "bg-blue-100 text-blue-800 border-blue-200",
    succeeded: "bg-green-100 text-green-800 border-green-200",
    failed: "bg-red-100 text-red-800 border-red-200",
  };
  const cls = map[status] || "bg-gray-100 text-gray-800 border-gray-200";
  return (
    <span
      className={`inline-block text-xs px-2 py-1 rounded-full border ${cls}`}
    >
      {status}
    </span>
  );
}
