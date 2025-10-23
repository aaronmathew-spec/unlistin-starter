"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/dashboard", { cache: "no-store" });
        const j = (await r.json()) as DashboardResponse;
        setData(j);
      } catch {
        // graceful fallback
        setData({
          requests: { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 },
          coverage: { total: 0, open: 0, in_progress: 0, resolved: 0 },
          brokers: { total: 0 },
          activity: [],
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const metrics = useMemo(() => {
    const d = data;
    if (!d) return [];
    return [
      {
        title: "Total Requests",
        primary: d.requests.total,
        sub: `${d.requests.open} open · ${d.requests.in_progress} in-progress`,
        href: "/requests",
      },
      {
        title: "Coverage Items",
        primary: d.coverage.total,
        sub: `${d.coverage.resolved} resolved`,
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
      <div className="bg-glow" aria-hidden />
      <div className="container" style={{ padding: 16 }}>
        {/* Header */}
        <header className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="pill">Your dashboard</div>
            <h1 className="hero-title" style={{ marginTop: 8 }}>At a glance</h1>
          </div>
          <Link href="/settings" className="btn btn-outline btn-lg">Settings</Link>
        </header>

        {/* KPIs */}
        <section className="kpi-wrap" style={{ marginTop: 16 }}>
          {(metrics ?? []).map((m) =>
            loading ? (
              <div key={m.title} className="panel" aria-busy="true" aria-live="polite">
                <div style={{ height: 14, width: 96, background: "rgba(255,255,255,.08)", borderRadius: 8, marginBottom: 8 }} />
                <div style={{ height: 28, width: 72, background: "rgba(255,255,255,.08)", borderRadius: 8 }} />
                <div style={{ height: 10, width: 160, background: "rgba(255,255,255,.06)", borderRadius: 8, marginTop: 8 }} />
              </div>
            ) : (
              <Link
                key={m.title}
                href={m.href}
                className="panel"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="kpi-title">{m.title}</div>
                <div className="kpi-primary">{m.primary}</div>
                {m.sub ? <div className="kpi-sub">{m.sub}</div> : null}
              </Link>
            )
          )}
          {!loading && metrics.length === 0 && (
            <div className="panel">No data yet — run a scan or create your first request.</div>
          )}
        </section>

        {/* Quick actions */}
        <section className="section" style={{ marginTop: 18 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div className="h3">Quick actions</div>
            <Link href="/requests" className="btn btn-ghost">All requests</Link>
          </div>

          <div className="feature-tiles">
            <Link href="/scan/quick" className="tile card" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="tile-title">Run Quick Scan</div>
              <div className="tile-sub">Instant, no account required. See what’s exposed.</div>
            </Link>
            <Link href="/ops/proofs/verify" className="tile card" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="tile-title">Verify a Bundle</div>
              <div className="tile-sub">Check manifest hash and signature quickly.</div>
            </Link>
            <Link href="/coverage" className="tile card" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="tile-title">Browse Coverage</div>
              <div className="tile-sub">Controllers, forms & quirks—kept current.</div>
            </Link>
          </div>
        </section>

        {/* Activity */}
        <section className="section" style={{ marginTop: 18 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div className="h3">Recent activity</div>
            <Link className="btn btn-ghost" href="/activity">View all</Link>
          </div>

          {loading ? (
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="panel" aria-busy="true">
                  <div style={{ height: 16, width: 220, background: "rgba(255,255,255,.08)", borderRadius: 8, marginBottom: 8 }} />
                  <div style={{ height: 12, width: 320, background: "rgba(255,255,255,.06)", borderRadius: 8 }} />
                </div>
              ))}
            </div>
          ) : data && data.activity.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, marginTop: 12, display: "grid", gap: 10 }}>
              {data.activity.map((a) => (
                <li key={a.id} className="card" style={{ padding: 14 }}>
                  <div className="row" style={{ alignItems: "start", justifyContent: "space-between" }}>
                    <div style={{ paddingRight: 12 }}>
                      <div style={{ fontWeight: 700 }}>
                        {prettyEntity(a.entity_type)} #{a.entity_id} — {prettyAction(a.action)}
                      </div>
                      {a.meta ? (
                        <pre
                          className="mono"
                          style={{ marginTop: 6, fontSize: 12, color: "var(--muted)", whiteSpace: "pre-wrap" }}
                        >
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
