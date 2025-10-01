// app/admin/flags/page.tsx
"use client";

import { useEffect, useState } from "react";

type Flag = { key: string; value: any; updated_at: string };

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [k, setK] = useState("");
  const [v, setV] = useState("{\"enabled\": true}");

  async function load() {
    setError(null);
    const res = await fetch("/api/admin/flags");
    const json = await res.json();
    if (!json.ok) setError(json.error || "Failed to load");
    else setFlags(json.flags || []);
  }

  async function save() {
    try {
      const parsed = JSON.parse(v);
      const res = await fetch("/api/admin/flags", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: k.trim(), value: parsed }),
      });
      const j = await res.json();
      if (!j.ok) alert(j.error || "Save failed");
      else {
        setK(""); setV("{\"enabled\": true}");
        load();
      }
    } catch {
      alert("Value must be valid JSON.");
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Feature Flags</h1>
      {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="mt-6 space-y-4">
        <div className="rounded-xl border p-4">
          <div className="text-sm font-medium">Add / Update Flag</div>
          <div className="mt-3 flex flex-col gap-2">
            <input value={k} onChange={(e) => setK(e.target.value)} placeholder="key (e.g., deep_check_enabled)" className="w-full rounded border px-3 py-2 text-sm" />
            <textarea value={v} onChange={(e) => setV(e.target.value)} placeholder='JSON value (e.g., {"enabled": true})' className="w-full rounded border px-3 py-2 text-sm min-h-[120px]" />
            <div>
              <button onClick={save} className="rounded-lg border px-3 py-1.5 text-sm">Save</button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-sm font-medium">Existing</div>
          <div className="mt-3 divide-y">
            {flags.map((f) => (
              <div key={f.key} className="py-3">
                <div className="text-sm text-gray-500">{f.key}</div>
                <pre className="mt-1 overflow-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(f.value, null, 2)}</pre>
                <div className="mt-1 text-xs text-gray-500">{new Date(f.updated_at).toLocaleString()}</div>
              </div>
            ))}
            {flags.length === 0 && <div className="py-4 text-sm text-gray-600">No flags yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
