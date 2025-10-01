// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* ---------- Types (kept compatible with your existing API shape) ---------- */

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

/* --------------------------------- Page ---------------------------------- */

export default function HomePage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [exposure, setExposure] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    // Always render even if APIs fail.
    const [dashRes, expRes] = await Promise.allSettled([
      fetch("/api/dashboard", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/exposure").then((r) => (r.ok ? r.json() : { score: null })),
    ]);

    // dashboard
    if (dashRes.status === "fulfilled" && dashRes.value) {
      setData(dashRes.value as DashboardResponse);
    } else {
      // graceful fallback (all zeros)
      setData({
        requests: { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 },
        coverage: { total: 0, open: 0, in_progress: 0, resolved: 0 },
        brokers: { total: 0 },
        activity: [],
      });
    }

    // exposure
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
    if (!d) return null;
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
    <main className="relative min-h-screen">
      {/* soft gradient background (CSP-safe) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_-10%,rgba(99,102,241,.10),rgba(255,255,255,0))]" />
        <div
          className="absolute -top-40 left-1/2 h-[620px] w-[980px] -translate-x-1/2 rounded-full blur-3xl opacity-25"
          style={{ background: "linear-gradient(90deg,#A78BFA,#60A5FA,#34D399)" }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-10">
        {/* Header / brand */}
        <header className="flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-500">Unlistin</div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Privacy Control Dashboard</h1>
          </div>
          {typeof exposure === "number" ? <ExposurePill score={exposure} /> : null}
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border bg-white shadow-[0_16px_60px_rgba(0,0,0,.06)]">
          <div className="absolute right-[-120px] top-[-100px] h-[320px] w-[320px] rounded-full blur-3xl opacity-20"
               style={{ background: "linear-gradient(45deg,#F472B6,#A78BFA)" }} />
          <div className="grid gap-6 p-6 md:grid-cols-2 md:p-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> RLS, CSP & allowlist enforced
              </div>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                Remove your personal data from the web —{" "}
                <span className="bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 bg-clip-text text-transparent">
                  India-first, AI-assisted
                </span>
                .
              </h2>
              <p className="text-sm text-neutral-600">
                Start with a <strong>Quick Scan</strong> (no sign-up, no PII stored). Upgrade to deep, automated removals with proofs and tracking.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href="/scan/quick" className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                  Run Quick Scan
                </Link>
                <Link href="/ai" className="rounded-xl border px-4 py-2 text-sm hover:bg-neutral-50">
                  Ask the AI assistant
                </Link>
                <Link href="/billing" className="rounded-xl border px-4 py-2 text-sm hover:bg-neutral-50">
                  Plans & Billing
                </Link>
              </div>

              <p className="text-xs text-neutral-500">
                Quick Scan inputs are transient in server runtime. Only redacted previews & evidence URLs are shown.
              </p>
            </div>

            {/* Visual KPIs card */}
            <div className="rounded-2xl border bg-white p-5">
              <div className="text-sm font-medium">At a glance</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {(metrics ?? []).map((m) => (
                  <Kpi key={m.title} title={m.title} primary={m.primary} sub={m.sub} href={m.href} loading={loading} />
                ))}
              </div>
              <div className="mt-4 grid gap-2 text-xs text-neutral-600">
                <div>• Strict domain allowlist • Server-only scan & scrape • pgvector & RLS</div>
                <div>• Multilingual concierge (guarded actions) • Evidence & audit trails</div>
              </div>
            </div>
          </div>
        </section>

        {/* Empty state nudge */}
        {!!data && data.requests.total === 0 && (
          <div className="rounded-2xl border bg-white p-5 flex flex-wrap items-center justify-between">
            <div className="text-sm text-neutral-700">
              No requests yet — create your first removal request to get started.
            </div>
            <Link href="/requests" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50">
              Create a Request
            </Link>
          </div>
        )}

        {/* Activity */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Recent Activity</h3>
            <Link className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50" href="/activity">
              View all
            </Link>
          </div>

          {loading ? (
            <ActivitySkeleton />
          ) : data && data.activity.length > 0 ? (
            <ul className="space-y-2">
              {data.activity.map((a) => (
                <li key={a.id} className="rounded-2xl border bg-white p-4 text-sm flex items-start justify-between">
                  <div className="pr-4">
                    <div className="font-medium">
                      {prettyEntity(a.entity_type)} #{a.entity_id} — {prettyAction(a.action)}
                    </div>
                    {a.meta ? (
                      <pre className="mt-1 text-xs text-neutral-600 whitespace-pre-wrap break-words">
                        {JSON.stringify(a.meta, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                  <div className="text-xs text-neutral-500 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border bg-white p-6 text-sm text-neutral-600">
              No activity yet. After you run scans and create requests, you’ll see events here.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* ------------------------------ Components ------------------------------- */

function Kpi({
  title,
  primary,
  sub,
  href,
  loading,
}: {
  title: string;
  primary: number | string;
  sub?: string;
  href?: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 mb-2" />
        <div className="h-7 w-16 animate-pulse rounded bg-neutral-200" />
        <div className="mt-2 h-3 w-40 animate-pulse rounded bg-neutral-100" />
      </div>
    );
  }
  return (
    <Link href={href || "#"} className="rounded-xl border bg-white p-4 hover:bg-neutral-50 block">
      <div className="text-xs text-neutral-600">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{primary}</div>
      {sub ? <div className="mt-1 text-[11px] leading-4 text-neutral-500">{sub}</div> : null}
    </Link>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border bg-white p-4">
          <div className="h-4 w-48 animate-pulse rounded bg-neutral-200 mb-2" />
          <div className="h-3 w-72 animate-pulse rounded bg-neutral-100" />
        </div>
      ))}
    </div>
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

/* ------------------------------- Utilities ------------------------------- */

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
