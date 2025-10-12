"use client";

import { useEffect, useState } from "react";

type Org = { id: string; name: string };
type RouteRow = { id: number; to_address: string; org_id: string; org_name: string };

async function listOrgs(): Promise<{ orgs: Org[] }> {
  const res = await fetch("/api/admin/orgs", { cache: "no-store" });
  if (!res.ok) throw new Error("load orgs failed");
  return res.json();
}
async function listRoutes(): Promise<{ routes: RouteRow[] }> {
  const res = await fetch("/api/admin/mail-routing", { cache: "no-store" });
  if (!res.ok) throw new Error("load routes failed");
  return res.json();
}
async function createRoute(to_address: string, org_id: string) {
  const res = await fetch("/api/admin/mail-routing", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ to_address, org_id })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error || "create failed");
  return j.route as RouteRow;
}
async function deleteRoute(id: number) {
  const res = await fetch("/api/admin/mail-routing", {
    method: "DELETE", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error || "delete failed");
}

export default function RoutingPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [toAddr, setToAddr] = useState("");
  const [orgId, setOrgId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    setErr(null);
    try {
      const [o, r] = await Promise.all([listOrgs(), listRoutes()]);
      setOrgs(o.orgs); setRoutes(r.routes);
      if (!orgId && o.orgs.length) setOrgId(o.orgs[0].id);
    } catch (e: any) { setErr(e?.message ?? "load failed"); }
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  async function onCreate() {
    if (!toAddr.trim() || !orgId) return;
    setBusy(true); setErr(null);
    try {
      await createRoute(toAddr.trim(), orgId);
      setToAddr("");
      await loadAll();
    } catch (e: any) { setErr(e?.message ?? "create failed"); }
    finally { setBusy(false); }
  }

  async function onDelete(id: number) {
    if (!confirm("Delete route?")) return;
    setBusy(true); setErr(null);
    try { await deleteRoute(id); await loadAll(); }
    catch (e: any) { setErr(e?.message ?? "delete failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Mail Routing</h1>

      <div className="grid gap-2 md:grid-cols-[1fr,220px,120px]">
        <input className="border rounded px-3 py-2" placeholder="to address (e.g. bot@yourdomain.com)"
               value={toAddr} onChange={e => setToAddr(e.target.value)} />
        <select className="border rounded px-3 py-2" value={orgId} onChange={e => setOrgId(e.target.value)}>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button onClick={onCreate} disabled={busy}
                className="px-3 py-2 rounded bg-black text-white disabled:opacity-60">
          {busy ? "Working…" : "Add"}
        </button>
      </div>

      {err && <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700">{err}</div>}

      <div className="grid gap-3">
        {routes.map(r => (
          <div key={r.id} className="border rounded p-3 flex items-center justify-between">
            <div className="text-sm">
              <div><b>to:</b> {r.to_address}</div>
              <div><b>org:</b> {r.org_name} <span className="text-gray-500">({r.org_id})</span></div>
            </div>
            <button onClick={() => onDelete(r.id)} className="text-red-600 hover:underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
