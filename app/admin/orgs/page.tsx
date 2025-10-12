"use client";

import { useEffect, useState } from "react";

type Org = { id: string; name: string; created_at: string };

async function listOrgs(): Promise<{ orgs: Org[] }> {
  const res = await fetch("/api/admin/orgs", { cache: "no-store" });
  if (!res.ok) throw new Error("load orgs failed");
  return res.json();
}
async function createOrg(name: string) {
  const res = await fetch("/api/admin/orgs", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error || "create failed");
  return j.org as Org;
}
async function deleteOrg(id: string) {
  const res = await fetch("/api/admin/orgs", {
    method: "DELETE", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error || "delete failed");
}

export default function OrgsPage() {
  const [items, setItems] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(null);
    try { const j = await listOrgs(); setItems(j.orgs); }
    catch (e: any) { setErr(e?.message ?? "load failed"); }
  }
  useEffect(() => { load(); }, []);

  async function onCreate() {
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try {
      await createOrg(name.trim());
      setName(""); await load();
    } catch (e: any) { setErr(e?.message ?? "create failed"); }
    finally { setBusy(false); }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete organization?")) return;
    setBusy(true); setErr(null);
    try { await deleteOrg(id); await load(); }
    catch (e: any) { setErr(e?.message ?? "delete failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Organizations</h1>

      <div className="flex gap-2">
        <input className="border rounded px-3 py-2 flex-1" placeholder="New org name"
               value={name} onChange={e => setName(e.target.value)} />
        <button onClick={onCreate} disabled={busy}
                className="px-3 py-2 rounded bg-black text-white disabled:opacity-60">
          {busy ? "Working…" : "Create"}
        </button>
      </div>

      {err && <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700">{err}</div>}

      <div className="grid gap-3">
        {items.map(o => (
          <div key={o.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{o.name}</div>
              <div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString()}</div>
              <div className="text-xs mt-1"><b>org_id:</b> <code>{o.id}</code></div>
            </div>
            <button onClick={() => onDelete(o.id)} className="text-red-600 hover:underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
