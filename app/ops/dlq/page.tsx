"use client";

import { useEffect, useState } from "react";

type DlqItem = {
  id: string | number;
  created_at: string;
  channel: string;
  controller_key: string;
  subject_id: string | null;
  payload: any;
  error_code: string | null;
  error_note: string | null;
  retries: number | null;
};

export default function OpsDlqPage() {
  const [items, setItems] = useState<DlqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/ops/dlq/list", {
        headers: secret ? { "x-secure-cron": secret } : undefined,
        cache: "no-store",
      });
      const j = await r.json();
      if (j.ok) setItems(j.items || []);
      else alert(j.error || "Failed to load DLQ");
    } catch (e: any) {
      alert(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // do nothing by default; require the secret (so you can paste it)
  }, []);

  async function requeue(id: string | number) {
    try {
      const r = await fetch("/api/ops/dlq/requeue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "x-secure-cron": secret } : {}),
        },
        body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (!j.ok) {
        alert(j.error || "Requeue failed");
        return;
      }
      await load();
      alert(`Requeued as ${j.requeuedAs ?? "job"}`);
    } catch (e: any) {
      alert(String(e?.message || e));
    }
  }

  return (
    <main>
      <div className="bg-glow" aria-hidden />
      <div className="container" style={{ padding: 16, maxWidth: 1000 }}>
        <header className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="pill">Ops</div>
            <h1 className="hero-title" style={{ marginTop: 8 }}>Dead-Letter Queue</h1>
            <div className="sub">Review failed dispatches and requeue items safely.</div>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <input
              className="input"
              placeholder="x-secure-cron secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              style={{ width: 240 }}
            />
            <button className="btn btn-outline" onClick={load}>Load</button>
          </div>
        </header>

        <section className="panel" style={{ marginTop: 16 }}>
          {loading ? (
            <div className="sub">Loading…</div>
          ) : items.length === 0 ? (
            <div className="empty">DLQ empty 🎉</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>When</th>
                    <th>Channel</th>
                    <th>Controller</th>
                    <th>Subject</th>
                    <th>Error</th>
                    <th>Retries</th>
                    <th>Payload</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={String(it.id)}>
                      <td style={{ fontFamily: "monospace" }}>{String(it.id)}</td>
                      <td>{new Date(it.created_at).toLocaleString()}</td>
                      <td>{it.channel}</td>
                      <td>{it.controller_key}</td>
                      <td style={{ fontFamily: "monospace" }}>{it.subject_id ?? "—"}</td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{it.error_code ?? "—"}</div>
                          <div style={{ color: "var(--muted)" }}>{it.error_note ?? ""}</div>
                        </div>
                      </td>
                      <td>{it.retries ?? 0}</td>
                      <td style={{ maxWidth: 360 }}>
                        <pre className="mono" style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "var(--muted)" }}>
                          {JSON.stringify(it.payload, null, 2)}
                        </pre>
                      </td>
                      <td>
                        {it.channel === "webform" ? (
                          <button className="btn" onClick={() => requeue(it.id)}>Requeue</button>
                        ) : (
                          <span className="sub">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
