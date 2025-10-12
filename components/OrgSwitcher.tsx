"use client";

import { useEffect, useState } from "react";

type Org = { id: string; name: string };

export default function OrgSwitcher() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      // your existing API: returns orgs for the logged-in user (RLS-safe)
      const oRes = await fetch("/api/me/organizations", { cache: "no-store" });
      const oJson = await oRes.json();
      const list: Org[] = Array.isArray(oJson?.organizations) ? oJson.organizations : (oJson?.orgs ?? []);
      setOrgs(list);

      // read current cookie
      const cRes = await fetch("/api/org/current", { cache: "no-store" });
      const cJson = await cRes.json();
      setCurrent(cJson?.org_id ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "failed to load orgs");
    }
  }

  useEffect(() => { load(); }, []);

  async function onChange(newId: string) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/org/current", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ org_id: newId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "failed to set org");
      setCurrent(newId);

      // reload to apply across pages/API calls that read cookie server-side
      window.location.reload();
    } catch (e: any) {
      setErr(e?.message ?? "failed to switch org");
    } finally {
      setBusy(false);
    }
  }

  if (orgs.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Org:</label>
      <select
        className="border rounded px-2 py-1 text-sm"
        value={current ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
      >
        <option value="" disabled>Select org…</option>
        {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
