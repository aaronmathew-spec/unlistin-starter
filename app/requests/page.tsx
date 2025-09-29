"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/providers/ToastProvider";

type RequestRow = {
  id: number;
  title: string | null;
  description: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string | null;
  updated_at: string | null;
};

type EditRow = {
  title: string;
  description: string;
  status: RequestRow["status"];
};

export default function RequestsIndexPage() {
  const { toast } = useToast();

  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | RequestRow["status"]>("");

  // create
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  // edit
  const [edit, setEdit] = useState<Record<number, EditRow>>({});

  function buildListUrl(cursor?: string | null) {
    const sp = new URLSearchParams();
    sp.set("limit", "50");
    if (cursor) sp.set("cursor", cursor);
    return `/api/requests?${sp.toString()}`;
  }

  async function fetchPage(cursor?: string | null) {
    const url = buildListUrl(cursor);
    const j = await fetch(url, { cache: "no-store" }).then((r) => r.json());
    return { rows: (j.requests ?? []) as RequestRow[], next: j.nextCursor ?? null };
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
      const hay =
        (r.title || "").toLowerCase() + " " + (r.description || "").toLowerCase();
      const okQ = !needle || hay.includes(needle);
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
    if (!title.trim()) {
      toast("Title is required");
      return;
    }
    const res = await fetch("/api/requests/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), description: desc.trim() || null }),
    });
    if (res.ok) {
      setTitle("");
      setDesc("");
      toast("Request created");
      await refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error?.message || j?.error || "Create failed");
    }
  }

  function startEdit(r: RequestRow) {
    setEdit((m) => ({
      ...m,
      [r.id]: {
        title: r.title ?? "",
        description: r.description ?? "",
        status: r.status,
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
    const res = await fetch("/api/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: e.title.trim(),
        description: e.description.trim() || null,
        status: e.status,
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
    if (!confirm("Delete this request?")) return;
    const res = await fetch("/api/requests?id=" + id, { method: "DELETE" });
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
    return qs ? `/api/requests/export?${qs}` : `/api/requests/export`;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Requests</h1>
        <div className="flex items-center gap-2">
          <Link href="/" className="px-3 py-1 rounded border hover:bg-gray-50">Dashboard</Link>
          <Link href="/requests/new" className="px-3 py-1 rounded border hover:bg-gray-50">New</Link>
        </div>
      </header>

      {/* Create */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Create Request</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="border rounded-lg px-3 py-2 min-w-[260px]"
          />
        </div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description (optional)"
          className="border rounded-lg px-3 py-2 w-full min-h-[92px]"
        />
        <button onClick={onCreate} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
          Create
        </button>
      </section>

      {/* Filters + Export */}
      <section className="border rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div className="md:col-span-2 flex flex-wrap gap-3 items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or description…"
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
            <option value="closed">Closed</option>
          </select>
          {(q || status) && (
            <button onClick={() => { setQ(""); setStatus(""); }} className="px-3 py-2 rounded-lg border hover:bg-gray-50">
              Reset
            </button>
          )}
        </div>
        <div className="flex md:justify-end">
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
          <div className="text-gray-600">No requests yet.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">ID</th>
                <th className="text-left px-4 py-2">Title</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Updated</th>
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
                      <Link href={`/requests/${r.id}`} className="underline text-blue-600">#{r.id}</Link>
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={e.title}
                          onChange={(ev) => setEdit((m) => ({ ...m, [r.id]: { ...e, title: ev.target.value } }))}
                        />
                      ) : (
                        r.title ?? "—"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <select
                          className="border rounded px-2 py-1 w-full"
                          value={e.status}
                          onChange={(ev) => setEdit((m) => ({ ...m, [r.id]: { ...e, status: ev.target.value as RequestRow["status"] } }))}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      ) : (
                        r.status.replace("_", " ")
                      )}
                    </td>
                    <td className="px-4 py-2">{r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}</td>
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
