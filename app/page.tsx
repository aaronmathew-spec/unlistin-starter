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
        <div className="hero-card" style={{ padding: 28 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span
              className="pill"
              style={{
                fontWeight: 700,
                letterSpacing: 0.2,
                background:
                  "linear-gradient(90deg, rgba(139,92,246,.12), rgba(59,130,246,.12))",
                border: "1px solid var(--card-border)",
              }}
            >
              Verifiable Privacy Ops
            </span>
            {typeof exposure === "number" ? <ExposurePill score={exposure} /> : <span />}
          </div>

          <h1
            style={{
              marginTop: 14,
              fontSize: 32,
              lineHeight: 1.25,
              fontWeight: 800,
              letterSpacing: -0.2,
              background:
                "linear-gradient(90deg,#ffffff, #dbeafe 35%, #c7d2fe 60%, #d1fae5 85%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Remove personal data — with proofs, follow-ups, and global coverage.
          </h1>

          <p className="sub" style={{ marginTop: 10, fontSize: 14.5 }}>
            Unlistin acts as your privacy fiduciary: we dispatch lawful requests, chase SLAs,
            and maintain tamper-evident evidence bundles for audits—globally.
          </p>

          <div className="row" style={{ marginTop: 16, gap: 10, flexWrap: "wrap" }}>
            <Link href="/scan/quick" className="btn">
              Run Quick Scan
            </Link>
            <Link href="/ops/proofs/verify" className="btn btn-outline">
              Verify Bundle
            </Link>
            <Link href="/billing" className="btn btn-ghost">
              Plans & Billing
            </Link>
          </div>

          <div
            className="row"
            style={{
              marginTop: 14,
              gap: 8,
              color: "var(--muted)",
              fontSize: 12.5,
              flexWrap: "wrap",
            }}
          >
            <TrustDot text="Short-lived evidence URLs" />
            <TrustDot text="Signed manifests (KMS/HSM)" />
            <TrustDot text="Merkle Proof-of-Action Ledger" />
            <TrustDot text="RLS & CSP enforced" />
          </div>
        </div>

        {/* “At a glance” KPIs panel */}
        <div className="card" style={{ borderRadius: 20, padding: 18 }}>
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
            • Allowlist only • Server-side scrape • RLS & pgvector • Exportable signed bundles
          </div>
        </div>
      </div>

      {/* Below hero */}
      <div className="container" style={{ marginTop: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="h2">Privacy Control Dashboard</div>
            <div className="lead" style={{ marginTop: 4 }}>
              Your requests, coverage, and evidence — centralized.
            </div>
          </div>
          {/* Exposure pill already shown in hero; we keep the right side clean here */}
        </div>

        {/* Feature row (refined, glassy) */}
        <div className="row" style={{ marginTop: 16, gap: 12, flexWrap: "wrap" }}>
          <FeatureTile
            title="Coverage Map"
            body="A living directory of controllers, forms & quirks — kept current and jurisdiction-aware."
          />
          <FeatureTile
            title="Evidence Locker"
            body="Downloadable ZIP bundles with signed manifests for internal audit or regulators."
          />
          <FeatureTile
            title="SLA Follow-ups"
            body="Escalations & reminders operate quietly in the background until closure."
          />
        </div>

        {/* Empty state nudge */}
        {!!data && data.requests.total === 0 && (
          <div className="panel row" style={{ justifyContent: "space-between", marginTop: 16 }}>
            <div className="lead" style={{ color: "var(--fg)" }}>
              No requests yet — create your first removal request to get started.
            </div>
            <Link href="/requests" className="btn btn-outline">
              Create a Request
            </Link>
          </div>
        )}

        {/* Activity */}
        <section className="section">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="h3">Recent Activity</div>
            <Link className="btn btn-ghost" href="/activity">
              View all
            </Link>
          </div>

          {loading ? (
            <ActivitySkeleton />
          ) : data && data.activity.length > 0 ? (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "12px 0 0 0",
                display: "grid",
                gap: 10,
              }}
            >
              {data.activity.map((a) => (
                <li key={a.id} className="card" style={{ padding: 14 }}>
                  <div
                    className="row"
                    style={{ alignItems: "start", justifyContent: "space-between" }}
                  >
                    <div style={{ paddingRight: 12 }}>
                      <div style={{ fontWeight: 700 }}>
                        {prettyEntity(a.entity_type)} #{a.entity_id} — {prettyAction(a.action)}
                      </div>
                      {a.meta ? (
                        <pre
                          className="mono"
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            color: "var(--muted)",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {JSON.stringify(a.meta, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}
                    >
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
        <div
          style={{
            height: 14,
            width: 96,
            background: "rgba(255,255,255,.08)",
            borderRadius: 8,
            marginBottom: 8,
          }}
        />
        <div
          style={{ height: 28, width: 72, background: "rgba(255,255,255,.08)", borderRadius: 8 }}
        />
        <div
          style={{
            height: 10,
            width: 160,
            background: "rgba(255,255,255,.06)",
            borderRadius: 8,
            marginTop: 8,
          }}
        />
      </div>
    );
  }
  return (
    <Link
      href={href || "#"}
      className="panel"
      style={{ textDecoration: "none", color: "inherit", minWidth: 220 }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800 }}>{primary}</div>
      {sub ? (
        <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>{sub}</div>
      ) : null}
    </Link>
  );
}

function FeatureTile({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="card"
      style={{
        flex: 1,
        minWidth: 260,
        padding: 16,
        borderRadius: 16,
        background:
          "linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0) 30%), var(--card)",
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13.5, color: "var(--muted)" }}>{body}</div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="panel">
          <div
            style={{
              height: 16,
              width: 220,
              background: "rgba(255,255,255,.08)",
              borderRadius: 8,
              marginBottom: 8,
            }}
          />
          <div
            style={{ height: 12, width: 320, background: "rgba(255,255,255,.06)", borderRadius: 8 }}
          />
        </div>
      ))}
    </div>
  );
}

function ExposurePill({ score }: { score: number }) {
  const style = (() => {
    if (score >= 75)
      return {
        background: "rgba(239,68,68,.12)",
        color: "#ef4444",
        border: "1px solid rgba(239,68,68,.2)",
      };
    if (score >= 40)
      return {
        background: "rgba(245,158,11,.12)",
        color: "#f59e0b",
        border: "1px solid rgba(245,158,11,.2)",
      };
    return {
      background: "rgba(16,185,129,.12)",
      color: "#10b981",
      border: "1px solid rgba(16,185,129,.2)",
    };
  })();
  return (
    <span
      style={{
        ...style,
        padding: "6px 10px",
        borderRadius: 999,
        fontWeight: 600,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      Exposure: {score}
    </span>
  );
}

/* ------------------------------- Utilities ------------------------------- */
function TrustDot({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid var(--card-border)",
        background: "var(--accent)",
      }}
    >
      <span
        style={{
          display: "inline-block",
          height: 6,
          width: 6,
          borderRadius: 999,
          background: "var(--brand)",
        }}
      />
      {text}
    </span>
  );
}

function prettyEntity(t: Act["entity_type"]) {
  switch (t) {
    case "request":
      return "Request";
    case "coverage":
      return "Coverage";
    case "broker":
      return "Broker";
    case "file":
      return "File";
  }
}
function prettyAction(a: Act["action"]) {
  switch (a) {
    case "create":
      return "Created";
    case "update":
      return "Updated";
    case "status":
      return "Status Changed";
    case "delete":
      return "Deleted";
    case "upload":
      return "Uploaded";
    case "download":
      return "Downloaded";
  }
}
