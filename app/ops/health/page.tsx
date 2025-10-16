// app/ops/health/page.tsx
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";

type Health = {
  ok: boolean;
  tookMs: number;
  checks: {
    env: Record<string, boolean | string | null>;
    supabase: { ok: boolean; overridesCount?: number | null; error?: string | null };
    cron: { hasSecret: boolean; advice: string };
    email: { provider: string; configured: boolean; advice: string };
    signing: { backend: string; kmsReady: boolean | null };
  };
};

export default function HealthPage() {
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/ops/health", { cache: "no-store" });
      const j = await res.json();
      setH(j as Health);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const okColor = (ok?: boolean) => (ok ? "#0a0" : "#c00");

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Ops · Health</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        Snapshot of critical configs for dispatch, overrides, email, signing, and cron automation.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #333", background: "white" }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        {h && <span style={{ opacity: 0.7 }}>took {h.tookMs} ms</span>}
      </div>

      {err && (
        <div style={{ padding: 12, border: "1px solid #f99", background: "#fee", borderRadius: 10, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {!h ? (
        <div style={{ padding: 16, border: "1px dashed #ccc", borderRadius: 12 }}>Loading…</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {/* ENV */}
          <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
            <h2 style={{ fontWeight: 700, margin: 0, marginBottom: 8 }}>Environment</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
              {Object.entries(h.checks.env).map(([k, v]) => (
                <li key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: typeof v === "boolean" ? okColor(v) : "#888",
                      display: "inline-block",
                    }}
                  />
                  <code style={{ minWidth: 260, display: "inline-block" }}>{k}</code>
                  <span style={{ opacity: 0.8 }}>{String(v)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Supabase */}
          <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
            <h2 style={{ fontWeight: 700, margin: 0, marginBottom: 8 }}>Supabase</h2>
            <div style={{ display: "grid", gap: 6 }}>
              <div>
                Status: <strong style={{ color: okColor(h.checks.supabase.ok) }}>
                  {h.checks.supabase.ok ? "OK" : "ERROR"}
                </strong>
              </div>
              {"overridesCount" in h.checks.supabase && (
                <div>controller_overrides: <code>{h.checks.supabase.overridesCount ?? "0"}</code></div>
              )}
              {h.checks.supabase.error && (
                <div style={{ color: "#c00" }}>error: {h.checks.supabase.error}</div>
              )}
            </div>
          </section>

          {/* Email */}
          <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
            <h2 style={{ fontWeight: 700, margin: 0, marginBottom: 8 }}>Email</h2>
            <div style={{ display: "grid", gap: 6 }}>
              <div>provider: <code>{h.checks.email.provider}</code></div>
              <div>configured: <strong style={{ color: okColor(h.checks.email.configured) }}>
                {h.checks.email.configured ? "yes" : "no"}
              </strong></div>
              <div style={{ opacity: 0.8 }}>{h.checks.email.advice}</div>
            </div>
          </section>

          {/* Signing */}
          <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
            <h2 style={{ fontWeight: 700, margin: 0, marginBottom: 8 }}>Signing</h2>
            <div style={{ display: "grid", gap: 6 }}>
              <div>backend: <code>{h.checks.signing.backend}</code></div>
              {h.checks.signing.kmsReady !== null && (
                <div>
                  KMS configured:{" "}
                  <strong style={{ color: okColor(h.checks.signing.kmsReady || false) }}>
                    {h.checks.signing.kmsReady ? "yes" : "no"}
                  </strong>
                </div>
              )}
            </div>
          </section>

          {/* Cron */}
          <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
            <h2 style={{ fontWeight: 700, margin: 0, marginBottom: 8 }}>Automation (Cron)</h2>
            <div style={{ display: "grid", gap: 6 }}>
              <div>
                secret set:{" "}
                <strong style={{ color: okColor(h.checks.cron.hasSecret) }}>
                  {h.checks.cron.hasSecret ? "yes" : "no"}
                </strong>
              </div>
              <div style={{ opacity: 0.8 }}>{h.checks.cron.advice}</div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
