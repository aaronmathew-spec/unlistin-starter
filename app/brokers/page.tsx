"use client";

import { useEffect, useMemo, useState } from "react";

type Broker = {
  id: number;
  name: string;
  url?: string | null;
  created_at?: string;
  updated_at?: string;
};

type EditRow = { name: string; url: string };
type EditState = Record<number, EditRow>;

export default function BrokersPage() {
  const [list, setList] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // create
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  // inline edit (strict: url is always a string in edit state)
  const [edit, setEdit] = useState<EditState>({});

  // inline message
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2200);
  };

  async function fetchPage(cursor?: string | null) {
    const u = new URL("/api/brokers", window.location.origin);
    u.searchParams.set("limit", "50");
    if (cursor) u.searchParams.set("cursor", cursor);
    const j = await fetch(u.toString(), { cache: "no-store" }).then((r) => r.json());
    return { rows: (j.brokers ?? []) as Broker[], next: j.nextCursor ?? null };
  }

  const refresh = async () => {
    setLoading(true);
    const { rows, next } = await fetchPage(null);
    setList(rows);
    setNextCursor(next);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (b) => b.name.toLowerCase().includes(needle) || (b.url ?? "").toLowerCase().includes(needle)
    );
  }, [list, q]);

  async function loadMore() {
    if (!nextCursor) return;
    const { rows, next } = await fetchPage(nextCursor);
    setList((prev) => [...prev, ...rows]);
    setNextCursor(next);
  }

  async function onCreate() {
    const n = name.trim();
    if (!n) return;
    const res = await fetch("/api/brokers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, url: url.trim() || undefined }),
    });
    if (res.ok) {
      setName("");
      setUrl("");
      flash("Broker created");
      await refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error?.message || j?.error || "Create failed");
    }
  }

  function startEdit(row: Broker) {
    setEdit((m) => ({ ...m, [row.id]: { name: row.name, url: row.url ?? "" } }));
  }

  function cancelEdit(id: number) {
    // Rebuild with entries so value type is concrete (EditRow) and the removed key is dropped
    setEdit((m) => {
      const next: EditState = {};
      for (const [k, val] of Object.entries(m)) {
        const key = Number(k);
        if (key === id) continue;
        next[key] = val as EditRow;
      }
      return next;
    });
  }

  async function saveEdit(id: number) {
    const e = edit[id];
    if (!e) return;
    const payload: Record<string, unknown> = { id, name: e.name.trim() };
    const trimmedUrl = e.url.trim();
    payload.url = trimmedUrl.length ? trimmedUrl : null;

    const res = await fetch("/api/brokers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      flash("Saved");
      await refresh();
      cancelEdit(id);
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error?.message || j?.error || "Update failed");
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this broker? (Blocked if coverage rows exist)")) return;
    const res = await fetch("/api/brokers?id=" + id, { method: "DELETE" });
    if (res.ok) {
      setList((prev) => prev.filter((b) => b.id !== id));
      flash("Deleted");
    } else {
      const j = await res.json().catch(() => ({}));
      if (res.status === 409 && j?.error) {
        alert(j.error); // "Broker has coverage items and cannot be deleted."
      } else {
        alert(j?.error?.message || j?.error || "Delete failed");
      }
    }
  }

  // Helpers to maintain strict EditRow type when updating fields
  function updateEditName(id: number, value: string) {
    setEdit((m) => {
      const prev: EditRow = m[id] ?? { name: "", url: "" };
      const nextRow: EditRow = { ...prev, name: value };
      const next: EditState = { ...m, [id]: nextRow };
      return next;
    });
  }
  function updateEditUrl(id: number, value: string) {
    setEdit((m) => {
      const prev: EditRow = m[id] ?? { name: "", url: "" };
      const nextRow: EditRow = { ...prev, url: value };
      const next: EditState = { ...m, [id]: nextRow };
      return next;
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Brokers</h1>
        {msg ? (
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm">{msg}</span>
        ) : null}
      </header>

      {/* Create */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Add Broker</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Broker name (e.g., Twitter)"
            className="border rounded-lg px-3 py-2 min-w-[240px]"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (optional)"
            className="border rounded-lg px-3 py-2 min-w-[320px]"
          />
          <button onClick={onCreate} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Add
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="border rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or URL…"
          className="border rounded-lg px-3 py-2 min-w-[260px] flex-1"
        />
        {q && (
          <button onClick={() => setQ("")} className="px-3 py-2 rounded-lg border hover:bg-gray-50">
            Reset
          </button>
        )}
      </section>

      {/* Table */}
      <section className="space-y-3">
        {loading ? (
          <div>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-600">No brokers yet.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">URL</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const e = edit[b.id];
                const isEditing = !!e;
                return (
                  <tr key={b.id} className="border-t">
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={e.name}
                          onChange={(ev) => updateEditName(b.id, ev.target.value)}
                        />
                      ) : (
                        b.name
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={e.url}
                          onChange={(ev) => updateEditUrl(b.id, ev.target.value)}
                          placeholder="https://…"
                        />
                      ) : b.url ? (
                        <a className="underline text-blue-600" href={b.url} target="_blank">
                          {b.url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(b.id)} className="px-2 py-1 rounded border hover:bg-gray-50">
                            Save
                          </button>
                          <button onClick={() => cancelEdit(b.id)} className="px-2 py-1 rounded border hover:bg-gray-50">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(b)} className="px-2 py-1 rounded border hover:bg-gray-50">
                            Edit
                          </button>
                          <button onClick={() => remove(b.id)} className="px-2 py-1 rounded border hover:bg-gray-50">
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {nextCursor && (
          <div className="flex justify-center">
            <button onClick={loadMore} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
              Load more
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
