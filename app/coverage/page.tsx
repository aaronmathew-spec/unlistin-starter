"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/providers/ToastProvider";

type Coverage = {
  id: number;
  broker_id: number;
  surface: string;
  status: "open" | "in_progress" | "resolved";
  weight: number | null;
  note: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EditRow = { surface: string; status: Coverage["status"]; weight: string; note: string };

export default function CoverageIndexPage() {
  const { toast } = useToast();

  const [rows, setRows] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | Coverage["status"]>("");

  // create
  const [brokerId, setBrokerId] = useState("");
  const [surface, setSurface] = useState("");
  const [note, setNote] = useState("");
  const [weight, setWeight] = useState("1");

  // edit
  const [edit, setEdit] = useState<Record<number, EditRow>>({});

  function buildListUrl(cursor?: string | null) {
    const sp = new URLSearchParams();
    sp.set("limit", "50");
    if (cursor) sp.set("cursor", cursor);
    return `/api/coverage?${sp.toString()}`;
  }

  async function fetchPage(cursor?: string | null) {
    const url = buildListUrl(cursor);
    const j = await fetch(url, { cache: "no-store" }).then((r) => r.json());
    return { rows: (j.coverage ?? []) as Coverage[], next: j.nextCursor ?? null };
  }

  async function refresh() {
    setLoading(true);
    const { rows, next } = await fetchPage(null);
    setRows(rows);
    setNextCursor(next);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const okStatus = status ? r.status === status : true;
      const okQ =
        !needle ||
        r.surface.toLowerCase().includes(needle) ||
        (r.note ?? "").toLowerCase().includes(needle);
      return okStatus && okQ;
    });
  }, [rows, q, status]);

  async function loadMore() {
    if (!nextCursor) return;
    const { rows, next } = await fetchPage(nextCursor);
    setRows((prev) => [...prev, ...rows]);
    setNextCursor(next);
  }

  async function onCreate() {
    const pid = Number(brokerId);
    if (!surface.trim() || !Number.isFinite(pid) || pid <= 0) {
      toast("Broker ID and surface are required");
      return;
    }
    const res = await fetch("/api/coverage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        broker_id: pid,
        surface: surface.trim(),
        note: note.trim() || undefined,
        weight: Number(weight) || 1,
      }),
    });
    if (res.ok) {
      setBrokerId("");
      setSurface("");
      setNote("");
      setWeight("1");
      toast("Coverage created");
      await refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error?.message || j?.error || "Create failed");
    }
  }

  function startEdit(r: Coverage) {
    setEdit((m) => ({
      ...m,
      [r.id]: {
        surface: r.surface,
        status: r.status,
        weight: String(r.weight ?? 1),
        note: r.note ?? "",
      },
    }));
  }
  function cancelEdit(id: number) {
    setEdit((m) => {
      const next: Record<number, EditRow> = {};
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
    const res = await fetch("/api/coverage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        surface: e.surface.trim(),
        status: e.status,
        weight: Number(e.weight) || 1,
        note: e.note.trim() || null,
      }),
    });
    if (res.ok) {
      toast("Saved");
      await refresh();
      cancelEdit(id);
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error?.message || j?.error || "Update failed");
    }
  }
  async function remove(id: number) {
    if (!confirm("Delete this coverage?")) return;
    const res = await fetch("/api/coverage?id=" + id, { method: "DELETE" });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast("Deleted");
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error?.message || j?.error || "Delete failed");
    }
  }

  function exportHref() {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    const qs = sp.toString();
    return qs ? `/api/coverage/export?${qs}` : `/api/coverage/export`;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Coverage</h1>
        <Link href="/" className="px-3 py-1 rounded border hover:bg-gray-50">Dashboard</Link>
      </header>

      {/* Create */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Add Coverage</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={brokerId}
            onChange={(e) => setBrokerId(e.target.value)}
            placeholder="Broker ID"
            className="border rounded-lg px-3 py-2 w-32"
          />
          <input
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
            placeholder="Surface"
            className="border rounded-lg px-3 py-2 min-w-[260px]"
          />
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Weight"
            className="border rounded-lg px-3 py-2 w-28"
            type="number"
            min={1}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="border rounded-lg px-3 py-2 min-w-[260px]"
          />
          <button onClick={onCreate} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Add
          </button>
        </div>
      </section>

      {/* Filters + Export */}
      <section className="border rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search surface or note…"
          className="border rounded-lg px-3 py-2 min-w-[260px] flex-1"
        />
        <select
          value={status}
          onChange={(e) => setStatus((e.target.value as any) || "")}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
        {(q || status) && (
          <button onClick={() => { setQ(""); setStatus(""); }} className="px-3 py-2 rounded-lg border hover:bg-gray-50">
            Reset
          </button>
        )}
        <div className="ml-auto">
          <a href={exportHref()} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Export CSV
          </a>
        </div>
      </section>

      {/* Table */}
      <section className="space-y-3">
        {loading ? (
          <div>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-600">No coverage yet.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">ID</th>
                <th className="text-left px-4 py-2">Broker</th>
                <th className="text-left px-4 py-2">Surface</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Weight</th>
                <th className="text-left px-4 py-2">Note</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const e = edit[r.id];
                const isEditing = !!e;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2">
                      <Link href={`/coverage/${r.id}`} className="underline text-blue-600">#{r.id}</Link>
                    </td>
                    <td className="px-4 py-2">{r.broker_id}</td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={e.surface}
                          onChange={(ev) => setEdit((m) => ({ ...m, [r.id]: { ...e, surface: ev.target.value } }))}
                        />
                      ) : (
                        r.surface
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <select
                          className="border rounded px-2 py-1 w-full"
                          value={e.status}
                          onChange={(ev) => setEdit((m) => ({ ...m, [r.id]: { ...e, status: ev.target.value as Coverage["status"] } }))}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      ) : (
                        r.status.replace("_", " ")
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          type="number"
                          min={1}
                          value={e.weight}
                          onChange={(ev) => setEdit((m) => ({ ...m, [r.id]: { ...e, weight: ev.target.value } }))}
                        />
                      ) : (
                        r.weight ?? 1
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={e.note}
                          onChange={(ev) => setEdit((m) => ({ ...m, [r.id]: { ...e, note: ev.target.value } }))}
                        />
                      ) : (
                        r.note ?? "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(r.id)} className="px-2 py-1 rounded border hover:bg-gray-50">Save</button>
                          <button onClick={() => cancelEdit(r.id)} className="px-2 py-1 rounded border hover:bg-gray-50">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} className="px-2 py-1 rounded border hover:bg-gray-50">Edit</button>
                          <button onClick={() => remove(r.id)} className="px-2 py-1 rounded border hover:bg-gray-50">Delete</button>
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
