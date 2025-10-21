"use client";

import { useEffect, useState } from "react";

type Health = {
  ok: boolean;
  summary: { ok: boolean; reasons: string[] };
  build: Record<string, any>;
  envs: Record<string, any>;
  supabase: { ok: boolean; value?: any; error?: string };
  queueDepth: number | null;
  lastWorkerSuccess: string | null;
  lastVerifyRecheck: string | null;
  email: { provider: string; configured: boolean };
  cronHeaderConfigured: boolean;
  endpoints: Record<string, string>;
};

export default function SystemClient() {
  const [data, setData] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/ops/system/health", { cache: "no-store" });
        const j = await res.json();
        if (!alive) return;
        if (!res.ok || !j?.ok) {
          setErr(j?.error || "Health endpoint error");
        } else {
          setData(j);
        }
      } catch (e: any) {
        if (alive) setErr(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const Card = (p: { title: string; children: any }) => (
    <div style={{
      border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff"
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{p.title}</div>
      {p.children}
    </div>
  );

  if (loading) return <p style={{ padding: 24 }}>Loading system health…</p>;
  if (err) return <p style={{ padding: 24, color: "#b91c1c" }}>Error: {err}</p>;
  if (!data) return <p style={{ padding: 24 }}>No data.</p>;

  const statusDot = (ok: boolean) => (
    <span style={{
      display: "inline-block", width: 10, height: 10, borderRadius: 999,
      background: ok ? "#16a34a" : "#dc2626", marginRight: 8
    }} />
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card title="Overall">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {statusDot(data.summary.ok)}
          <span>{data.summary.ok ? "All green" : "Attention needed"}</span>
        </div>
        {!data.summary.ok && (
          <ul style={{ marginTop: 8 }}>
            {data.summary.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </Card>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        <Card title="Build">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(data.build, null, 2)}
          </pre>
        </Card>

        <Card title="Email">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {statusDot(data.email.configured)}
            <span>{data.email.provider} · {data.email.configured ? "configured" : "missing env"}</span>
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        <Card title="Supabase">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {statusDot(!!data.supabase?.ok)}
            <span>{data.supabase?.ok ? "connected" : data.supabase?.error || "not connected"}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 14, color: "#444" }}>
            Queue depth: <b>{data.queueDepth ?? "unknown"}</b>
            <br />
            Last worker success: <b>{data.lastWorkerSuccess ?? "n/a"}</b>
            <br />
            Last verify recheck: <b>{data.lastVerifyRecheck ?? "n/a"}</b>
          </div>
        </Card>

        <Card title="Cron Endpoints">
          <div style={{ fontSize: 14 }}>
            <div>Header configured: <b>{data.cronHeaderConfigured ? "yes" : "no"}</b></div>
            <ul style={{ marginTop: 8 }}>
              <li>Worker: <code>{data.endpoints.worker}</code></li>
              <li>Recheck: <code>{data.endpoints.verifyRecheck}</code></li>
              <li>Alert: <code>{data.endpoints.verifyAlert}</code></li>
            </ul>
          </div>
        </Card>
      </div>

      <Card title="Env Snapshot">
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(data.envs, null, 2)}
        </pre>
      </Card>
    </div>
  );
}
