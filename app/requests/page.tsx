"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Req = {
  id: number;
  title: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string | null;
  updated_at: string | null;
};

const STATUSES: Req["status"][] = ["open", "in_progress", "resolved", "closed"];

export default function RequestsPage() {
  // list + filters
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"" | Req["status"]>("");
  const [q, setQ] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // create form
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  // ephemeral inline message (replaces toasts)
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = [...items];
    if (status) rows = rows.filter((r) => r.status === status);
    if (needle) rows = rows.filter((r) => (r.title ?? "").toLowerCase().includes(needle));
    return rows;
  }, [items, status, q]);

  async function fetchPage(cursor?: string | null) {
    const u = new URL("/api/requests", window.location.origin);
    u.searchParams.set("limit", "50");
    if (cursor) u.searchParams.set("cursor", cursor);
    if (status) u.searchParams.set("status", status);
    if (q.trim()) u.searchParams.set("q", q.trim());
    const j = await fetch(u.toString(), { cache: "no-store" }).then((r) => r.json());
    return { rows: (j.requests ?? []) as Req[], next: j.nextCursor ?? null };
  }

  const refresh = async () => {
    setLoading(true);
    const { rows, next } = await fetchPage(null);
    setItems(rows);
    setNextCursor(next);
    setLoading(false);
  };

  useEffect(() => {
    // reload when filters change
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q]);

  async function onCreate() {
    const t = title.trim();
    if (!t) return;
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, description: desc.trim() || undefined }),
    });
    if (res.ok) {
      setTitle(""); setDesc("");
      flash("Request created");
      await refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      flash(j?.error || "Create failed");
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    const { rows, next } = await fetchPage(nextCursor);
    setItems((prev) => [...prev, ...rows]);
    setNextCursor(next);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Requests</h1>
        {msg ? (
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm">{msg}</span>
        ) : null}
      </header>

      {/* Create */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Create Request</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border rounded-lg px-3 py-2 min-w-[260px] flex-1"
            placeholder="Title"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="border rounded-lg px-3 py-2 min-w-[320px] flex-1"
            placeholder="Description (optional)"
          />
          <button onClick={onCreate} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Create
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="border rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <select
          value={status}
          onChange={(e) => setStatus((e.target.value as any) || "")}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{label(s)}</option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title…"
          className="border rounded-lg px-3 py-2 min-w-[260px] flex-1"
        />
        {(status || q) && (
          <button
            onClick={() => { setStatus(""); setQ(""); }}
            className="px-3 py-2 rounded-lg border hover:bg-gray-50"
          >
            Reset
          </button>
        )}
      </section>

      {/* Table */}
      <section className="space-y-3">
        {loading ? (
          <div>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-600">No requests found.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">ID</th>
                <th className="text-left px-4 py-2">Title</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Created</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">#{r.id}</td>
                  <td className="px-4 py-2">{r.title ?? "—"}</td>
                  <td className="px-4 py-2">{label(r.status)}</td>
                  <td className="px-4 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/requests/${r.id}`}
                      className="px-3 py-1 rounded border hover:bg-gray-50"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
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

function label(s: Req["status"]) {
  switch (s) {
    case "open":
      return "Open";
    case "in_progress":
      return "In Progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
  }
}
