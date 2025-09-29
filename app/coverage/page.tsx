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

const ALL_STATUSES: Coverage["status"][] = ["open", "in_progress", "resolved"];

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

  // bulk select
  const [selected, setSelected] = useState<Record<number, true>>({});

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
    setSelected({});
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

  const allOnPageSelected = filtered.length > 0 && filtered.every((r) => selected[r.id]);
  const anySelected = Object.keys(selected).length > 0;

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
      setSelected((m) => {
        const next = { ...m };
        delete next[id];
        return next;
      });
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error?.message || j?.error || "Delete failed");
    }
  }

  // Bulk actions
  function toggleRow(id: number, checked: boolean) {
    setSelected((m) => {
      const next = { ...m };
      if (checked) next[id] = true;
      else delete next[id];
      return next;
    });
  }
  function toggleAllOnPage(checked: boolean) {
    if (!checked) {
      setSelected((m) => {
        const next = { ...m };
        for (const r of filtered) delete next[r.id];
        return next;
      });
      return;
    }
    setSelected((m) => {
      const next = { ...m };
      for (const r of filtered) next[r.id] = true;
      return next;
    });
  }
  async function bulkSetStatus(s: Coverage["status"]) {
    const ids = Object.keys(selected).map((k) => Number(k)).filter((n) => Number.isFinite(n));
    if (ids.length === 0) return;
    for (const id of ids) {
      await fetch("/api/coverage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: s }),
      });
    }
    toast(`Updated ${ids.length} item${ids.length > 1 ? "s" : ""}`);
    await refresh();
  }
  async function bulkDelete() {
    const ids = Object.keys(selected).map((k) => Number(k)).filter((n) => Number.isFinite(n));
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected coverage item${ids.length > 1 ? "s" : ""}?`)) return;
    for (const id of ids) {
      await fetch("/api/coverage?id=" + id, { method: "DELETE" });
    }
    toast(`Deleted ${ids.length} item${ids.length > 1 ? "s" : ""}`);
    await refresh();
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
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
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

      {/* Bulk bar */}
      {anySelected && (
        <div className="border rounded-xl p-3 flex flex-wrap items-center gap-2 bg-amber-50">
          <div className="text-sm">
            Selected: <strong>{Object.keys(selected).length}</strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Set status:</span>
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => bulkSetStatus(s)}
                className="px-2 py-1 rounded border hover:bg-gray-50 text-sm"
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          <button onClick={bulkDelete} className="px-2 py-1 rounded border hover:bg-gray-50 text-sm">
            Delete selected
          </button>
          <button onClick={() => setSelected({})} className="ml-auto px-2 py-1 rounded border hover:bg-gray-50 text-sm">
            Clear selection
          </button>
        </div>
      )}

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
                <th className="px-4 py-2">
                  <input
                    aria-label="Select all"
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={(e) => toggleAllOnPage(e.target.checked)}
                  />
                </th>
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
                const checked = !!selected[r.id];
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2">
                      <input
                        aria-label={`Select ${r.id}`}
                        type="checkbox"
                        checked={checked}
                        onChange={(ev) => toggleRow(r.id, ev.target.checked)}
                      />
                    </td>
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
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
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
