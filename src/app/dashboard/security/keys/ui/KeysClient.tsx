"use client";

import { useState } from "react";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[] | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export default function KeysClient({ initialKeys }: { initialKeys: KeyRow[] }) {
  const [keys, setKeys] = useState<KeyRow[]>(initialKeys);
  const [tokenOnce, setTokenOnce] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState("runs.create,subjects.create");

  async function refresh() {
    const res = await fetch("/api/admin/keys/list");
    const j = await res.json();
    setKeys(j.keys || []);
  }

  async function createKey() {
    const res = await fetch("/api/admin/keys/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name || "key",
        scopes: scopes.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    const j = await res.json();
    if (!res.ok) return alert(j.error || "Failed to create");
    setTokenOnce(j.token);
    setName("");
    setScopes("runs.create,subjects.create");
    await refresh();
  }

  async function revoke(id: string) {
    const res = await fetch("/api/admin/keys/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keyId: id }),
    });
    if (!res.ok) {
      const j = await res.json();
      return alert(j.error || "Failed to revoke");
    }
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-xl space-y-3">
        <div className="font-medium">Create a new key</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="border rounded px-3 py-2 flex-1" placeholder="Name (e.g., CI key)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="border rounded px-3 py-2 flex-1" placeholder="Scopes (comma separated)" value={scopes} onChange={(e) => setScopes(e.target.value)} />
          <button onClick={createKey} className="px-3 py-2 rounded bg-black text-white">Create</button>
        </div>
        {tokenOnce && (
          <div className="p-3 bg-yellow-50 border rounded">
            <div className="text-sm font-medium mb-1">Copy your token now (shown once):</div>
            <div className="font-mono break-all text-sm">{tokenOnce}</div>
            <div className="text-xs text-neutral-600 mt-1">Store it securely. You won’t see it again.</div>
          </div>
        )}
      </div>

      <div className="p-4 border rounded-xl">
        <div className="font-medium mb-2">Existing keys</div>
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="border rounded p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <div className="text-sm">
                <div><span className="font-medium">{k.name}</span> — <span className="font-mono">{k.prefix}</span></div>
                <div className="text-xs text-neutral-600">Scopes: {(k.scopes || []).join(", ") || "—"}</div>
                <div className="text-xs text-neutral-600">Created: {new Date(k.created_at).toLocaleString()}</div>
                <div className="text-xs text-neutral-600">Last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "—"}</div>
                <div className="text-xs text-neutral-600">Revoked: {k.revoked_at ? new Date(k.revoked_at).toLocaleString() : "—"}</div>
              </div>
              <div className="flex gap-2">
                {!k.revoked_at && (
                  <button onClick={() => revoke(k.id)} className="px-3 py-2 rounded border">Revoke</button>
                )}
              </div>
            </div>
          ))}
          {keys.length === 0 && <div className="text-sm text-neutral-600">No keys yet.</div>}
        </div>
      </div>
    </div>
  );
}
