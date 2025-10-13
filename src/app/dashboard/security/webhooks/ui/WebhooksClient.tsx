"use client";

import { useState } from "react";

type HookRow = {
  id: string;
  url: string;
  events: string[] | null;
  disabled: boolean;
  created_at: string;
};

export default function WebhooksClient({ initialWebhooks }: { initialWebhooks: HookRow[] }) {
  const [hooks, setHooks] = useState<HookRow[]>(initialWebhooks);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState("run.updated,run.completed");

  async function refresh() {
    const res = await fetch("/api/admin/webhooks/list");
    const j = await res.json();
    setHooks(j.webhooks || []);
  }

  async function createWebhook() {
    const res = await fetch("/api/admin/webhooks/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url,
        secret,
        events: events.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    const j = await res.json();
    if (!res.ok) return alert(j.error || "Failed to create webhook");
    setUrl("");
    setSecret("");
    setEvents("run.updated,run.completed");
    await refresh();
  }

  async function setDisabled(id: string, disabled: boolean) {
    const res = await fetch("/api/admin/webhooks/disable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, disabled }),
    });
    const j = await res.json();
    if (!res.ok) return alert(j.error || "Failed to update");
    await refresh();
  }

  async function sendTest() {
    const res = await fetch("/api/admin/webhooks/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "run.updated" }),
    });
    const j = await res.json();
    if (!res.ok) return alert(j.error || "Failed to send test");
    alert("Test event sent.");
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-xl space-y-3">
        <div className="font-medium">Create webhook</div>
        <div className="grid sm:grid-cols-3 gap-2">
          <input className="border rounded px-3 py-2" placeholder="https://example.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Secret (min 16 chars)" value={secret} onChange={(e) => setSecret(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Events (comma-separated)" value={events} onChange={(e) => setEvents(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={createWebhook} className="px-3 py-2 rounded bg-black text-white">Add</button>
          <button onClick={sendTest} className="px-3 py-2 rounded border">Send Test</button>
        </div>
      </div>

      <div className="p-4 border rounded-xl">
        <div className="font-medium mb-2">Configured webhooks</div>
        <div className="space-y-2">
          {hooks.map((h) => (
            <div key={h.id} className="border rounded p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <div className="text-sm">
                <div className="font-mono break-all">{h.url}</div>
                <div className="text-xs text-neutral-600">Events: {(h.events || []).join(", ") || "—"}</div>
                <div className="text-xs text-neutral-600">Created: {new Date(h.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDisabled(h.id, !h.disabled)}
                  className={`px-3 py-2 rounded ${h.disabled ? "bg-green-600 text-white" : "border"}`}
                >
                  {h.disabled ? "Enable" : "Disable"}
                </button>
              </div>
            </div>
          ))}
          {hooks.length === 0 && <div className="text-sm text-neutral-600">No webhooks configured.</div>}
        </div>
      </div>
    </div>
  );
}
