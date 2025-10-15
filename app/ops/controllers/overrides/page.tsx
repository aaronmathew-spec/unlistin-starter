// app/ops/controllers/overrides/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  controller_key: string;
  preferred_channel: "email" | "webform" | null;
  email_override: string | null;
  allowed_channels: ("email" | "webform")[] | null;
  slas: { acknowledgeMin?: number | null; resolveMin?: number | null } | null;
  identity: { hints?: string[] | null } | null;
  updated_at?: string | null;
};

const SECRET = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_SECURE_CRON_PREVIEW || "") : "";

function envWarnMissingSecret() {
  if (!SECRET) {
    // eslint-disable-next-line no-alert
    alert("NEXT_PUBLIC_SECURE_CRON_PREVIEW not set. For local testing, set it to your SECURE_CRON_SECRET.");
  }
}

export default function OverridesPage() {
  const [data, setData] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<Row>({
    controller_key: "",
    preferred_channel: null,
    email_override: "",
    allowed_channels: ["email", "webform"],
    slas: { acknowledgeMin: 60, resolveMin: 1440 },
    identity: { hints: [] },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const f = filter.trim().toLowerCase();
    if (!f) return data;
    return data.filter(r => r.controller_key.includes(f));
  }, [data, filter]);

  async function load() {
    envWarnMissingSecret();
    setLoading(true);
    try {
      const res = await fetch("/api/ops/controllers/overrides", {
        headers: { "x-ops-secret": SECRET },
      });
      const j = await res.json();
      if (j.ok) setData(j.data as Row[]);
      else throw new Error(j.error || "Failed to load");
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      alert(`Load error: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    envWarnMissingSecret();
    setLoading(true);
    try {
      const payload = {
        controllerKey: form.controller_key.trim().toLowerCase(),
        preferredChannel: form.preferred_channel,
        emailOverride: form.email_override || null,
        allowedChannels: form.allowed_channels,
        slas: form.slas,
        identity: form.identity,
      };
      const res = await fetch("/api/ops/controllers/overrides", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ops-secret": SECRET,
        },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Save failed");
      await load();
      // eslint-disable-next-line no-alert
      alert("Saved.");
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      alert(`Save error: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  function pick(row: Row) {
    setForm({
      controller_key: row.controller_key,
      preferred_channel: row.preferred_channel,
      email_override: row.email_override || "",
      allowed_channels: row.allowed_channels || ["email", "webform"],
      slas: row.slas || { acknowledgeMin: 60, resolveMin: 1440 },
      identity: { hints: row.identity?.hints || [] },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Controller Overrides</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        Prefer email vs webform, desk address, SLAs, and identity hints—without redeploys.
      </p>

      <form onSubmit={submit} style={{
        display: "grid", gap: 12, padding: 16, border: "1px solid #eee",
        borderRadius: 12, background: "#fafafa"
      }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label>Controller key (e.g., <code>truecaller</code>)</label>
          <input
            required
            value={form.controller_key}
            onChange={(e) => setForm({ ...form, controller_key: e.target.value })}
            placeholder="truecaller"
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Preferred channel</label>
          <select
            value={form.preferred_channel || ""}
            onChange={(e) => setForm({ ...form, preferred_channel: (e.target.value || null) as any })}
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
          >
            <option value="">(inherit)</option>
            <option value="email">email</option>
            <option value="webform">webform</option>
          </select>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Desk email override</label>
          <input
            value={form.email_override || ""}
            onChange={(e) => setForm({ ...form, email_override: e.target.value })}
            placeholder="privacy@example.com"
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Allowed channels</label>
          <div style={{ display: "flex", gap: 12 }}>
            {["email", "webform"].map(ch => {
              const checked = form.allowed_channels?.includes(ch as "email" | "webform");
              return (
                <label key={ch} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={!!checked}
                    onChange={(e) => {
                      const set = new Set(form.allowed_channels || []);
                      if (e.target.checked) set.add(ch as any); else set.delete(ch as any);
                      setForm({ ...form, allowed_channels: Array.from(set) as any });
                    }}
                  />
                  {ch}
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>SLAs (minutes)</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input
              type="number"
              min={0}
              value={form.slas?.acknowledgeMin ?? ""}
              onChange={(e) => setForm({ ...form, slas: { ...(form.slas || {}), acknowledgeMin: Number(e.target.value || 0) } })}
              placeholder="acknowledgeMin (e.g., 60)"
              style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
            />
            <input
              type="number"
              min={0}
              value={form.slas?.resolveMin ?? ""}
              onChange={(e) => setForm({ ...form, slas: { ...(form.slas || {}), resolveMin: Number(e.target.value || 0) } })}
              placeholder="resolveMin (e.g., 1440)"
              style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Identity hints (comma-separated)</label>
          <input
            value={(form.identity?.hints || []).join(", ")}
            onChange={(e) => setForm({ ...form, identity: { hints: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } })}
            placeholder="PAN (masked), Aadhaar (last 4), Govt ID (redacted)…"
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 16px", borderRadius: 10, border: "1px solid #0a0",
              background: "#0a0", color: "white", fontWeight: 600
            }}
          >
            {loading ? "Saving…" : "Save / Upsert"}
          </button>
          <button
            type="button"
            onClick={load}
            style={{
              padding: "10px 16px", borderRadius: 10, border: "1px solid #333",
              background: "white", color: "#333", fontWeight: 600
            }}
          >
            Refresh
          </button>
        </div>
      </form>

      <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Existing</h2>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by controller key…"
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", width: 280 }}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {(filtered || []).map(r => (
            <div key={r.controller_key} style={{
              display: "grid", gap: 6, padding: 12, border: "1px solid #eee",
              borderRadius: 12, background: "white"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <strong>{r.controller_key}</strong>
                  <span style={{ marginLeft: 8, opacity: 0.6 }}>
                    {r.updated_at ? new Date(r.updated_at).toLocaleString() : ""}
                  </span>
                </div>
                <button
                  onClick={() => pick(r)}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #333", background: "white" }}
                >
                  Edit
                </button>
              </div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                <div>preferred: <code>{r.preferred_channel ?? "(inherit)"}</code></div>
                <div>desk: <code>{r.email_override || "(none)"}</code></div>
                <div>allowed: <code>{(r.allowed_channels || []).join(", ") || "(inherit)"}</code></div>
                <div>slas: <code>ack={r.slas?.acknowledgeMin ?? "-"}m, resolve={r.slas?.resolveMin ?? "-" }m</code></div>
                <div>identity: <code>{(r.identity?.hints || []).join(", ") || "(none)"}</code></div>
              </div>
            </div>
          ))}
          {!filtered?.length && (
            <div style={{ padding: 16, border: "1px dashed #ddd", borderRadius: 12, textAlign: "center", opacity: 0.7 }}>
              No overrides yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
