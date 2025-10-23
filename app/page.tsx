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
    if (expRes.status === "fulfilled" && typeof (expRes.value as any)?.score === "number") {
      setExposure(Math.round((expRes.value as any).score));
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
    <main>
      {/* HERO */}
      <div className="hero">
        <div className="hero-card">
          <span className="pill">Verifiable Privacy Ops</span>
          <h1>Remove personal data — with proofs, follow-ups, and global coverage.</h1>
          <p className="sub">
            Unlistin acts as your privacy fiduciary: we dispatch deletion requests, chase SLAs,
            and produce tamper-evident evidence bundles for audits—globally.
          </p>

          <div className="row" style={{ marginTop: 14 }}>
            <Link href="/scan/quick" className="btn">Run Quick Scan</Link>
            <Link href="/ops/proofs/verify" className="btn btn-outline">Verify Bundle</Link>
            <Link href="/billing" className="btn btn-ghost">Plans & Billing</Link>
          </div>

          <p className="lead" style={{ marginTop: 8, fontSize: 12 }}>
            Quick Scan inputs are transient. Only redacted previews & signed evidence are retained.
          </p>
        </div>

        {/* “At a glance” KPIs panel */}
        <div className="card" style={{ borderRadius: 20 }}>
          <div className="h3">At a glance</div>
          <div className="divider" />
          <div className="row" style={{ gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
            {(metrics ?? []).map((m) => (
              <Kpi
                key={m.title}
                title={m.title}
                primary={m.primary}
                sub={m.sub}
                href={m.href}
                loading={loading}
              />
            ))}
          </div>
          <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
            • Strict allowlist • Server-only scrape • RLS & pgvector • Signed proof bundles
          </div>
        </div>
      </div>

      {/* Exposure & header row below hero */}
      <div className="container" style={{ marginTop: 18 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h2">Privacy Control Dashboard</div>
            <div className="lead" style={{ marginTop: 4 }}>Your requests, coverage and evidence—centralized.</div>
          </div>
          {typeof exposure === "number" ? <ExposurePill score={exposure} /> : null}
        </div>

        {/* Empty state nudge */}
        {!!data && data.requests.total === 0 && (
          <div className="panel row" style={{ justifyContent: "space-between", marginTop: 16 }}>
            <div className="lead" style={{ color: "var(--fg)" }}>
              No requests yet — create your first removal request to get started.
            </div>
            <Link href="/requests" className="btn btn-outline">Create a Request</Link>
          </div>
        )}

        {/* Activity */}
        <section className="section">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="h3">Recent Activity</div>
            <Link className="btn btn-ghost" href="/activity">View all</Link>
          </div>

          {loading ? (
            <ActivitySkeleton />
          ) : data && data.activity.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0 0", display: "grid", gap: 10 }}>
              {data.activity.map((a) => (
                <li key={a.id} className="card" style={{ padding: 14 }}>
                  <div className="row" style={{ alignItems: "start", justifyContent: "space-between" }}>
                    <div style={{ paddingRight: 12 }}>
                      <div style={{ fontWeight: 700 }}>
                        {prettyEntity(a.entity_type)} #{a.entity_id} — {prettyAction(a.action)}
                      </div>
                      {a.meta ? (
                        <pre className="mono" style={{ marginTop: 6, fontSize: 12, color: "var(--muted)", whiteSpace: "pre-wrap" }}>
                          {JSON.stringify(a.meta, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty" style={{ marginTop: 12 }}>
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
      <div className="panel" style={{ minWidth: 220 }}>
        <div style={{ height: 14, width: 96, background: "rgba(255,255,255,.08)", borderRadius: 8, marginBottom: 8 }} />
        <div style={{ height: 28, width: 72, background: "rgba(255,255,255,.08)", borderRadius: 8 }} />
        <div style={{ height: 10, width: 160, background: "rgba(255,255,255,.06)", borderRadius: 8, marginTop: 8 }} />
      </div>
    );
  }
  return (
    <Link href={href || "#"} className="panel" style={{ textDecoration: "none", color: "inherit", minWidth: 220 }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800 }}>{primary}</div>
      {sub ? <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>{sub}</div> : null}
    </Link>
  );
}

function ActivitySkeleton() {
  return (
    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="panel">
          <div style={{ height: 16, width: 220, background: "rgba(255,255,255,.08)", borderRadius: 8, marginBottom: 8 }} />
          <div style={{ height: 12, width: 320, background: "rgba(255,255,255,.06)", borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}

function ExposurePill({ score }: { score: number }) {
  const style = (() => {
    if (score >= 75) return { background: "rgba(239,68,68,.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,.2)" };
    if (score >= 40) return { background: "rgba(245,158,11,.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.2)" };
    return { background: "rgba(16,185,129,.12)", color: "#10b981", border: "1px solid rgba(16,185,129,.2)" };
  })();
  return (
    <span style={{ ...style, padding: "6px 10px", borderRadius: 999, fontWeight: 600, fontSize: 13 }}>
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
