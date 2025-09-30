"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ReqRow = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
};

const STATUSES = [
  { v: "", label: "All" },
  { v: "open", label: "Open" },
  { v: "in_progress", label: "In Progress" },
  { v: "closed", label: "Closed" },
];

export default function RequestsIndexList() {
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Filters
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const PAGE = 20;

  // Debounce search input -> q
  const debounceRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    // @ts-expect-error browser setTimeout type
    debounceRef.current = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(debounceRef.current);
  }, [qInput]);

  async function fetchPage(opts?: { reset?: boolean }) {
    const reset = !!opts?.reset;
    if (reset) {
      setRows([]);
      setCursor(null);
      setHasMore(true);
      setErr(null);
      setLoading(true);
    }
    try {
      const qs = new URLSearchParams();
      qs.set("limit", String(PAGE));
      qs.set("dir", dir);
      if (q) qs.set("q", q);
      if (status) qs.set("status", status);
      if (!reset && cursor) qs.set("cursor", cursor);

      const res = await fetch("/api/requests?" + qs.toString(), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load");

      setRows((cur) => (reset ? data.requests : cur.concat(data.requests)));
      setCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.nextCursor));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  // initial + whenever filters change (q/status/dir)
  const filterSignature = useMemo(() => `${q}|${status}|${dir}`, [q, status, dir]);
  useEffect(() => {
    fetchPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search title or description…"
          className="min-w-[240px] flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border px-2 py-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s.v} value={s.v}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={dir}
          onChange={(e) => setDir(e.target.value as "asc" | "desc")}
          className="rounded-md border px-2 py-2 text-sm"
        >
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
        <button
          onClick={() => fetchPage({ reset: true })}
          className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
        >
          Apply
        </button>
        <button
          onClick={() => {
            setQInput("");
            setStatus("");
            setDir("desc");
          }}
          className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
        >
          Reset
        </button>
      </div>

      {err && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="rounded-md border p-3 text-sm text-neutral-600">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border p-3 text-sm text-neutral-600">No requests found.</div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">#{r.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.title}</div>
                    {r.description && (
                      <div className="text-neutral-500 line-clamp-1">{r.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <a
                      href={`/requests/${r.id}`}
                      className="rounded-md border px-2 py-1 hover:bg-neutral-50"
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-500">
          {rows.length} loaded {hasMore ? "— more available" : "— end"}
        </div>
        {hasMore && (
          <button
            onClick={() => fetchPage()}
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
            disabled={loading}
          >
            Load more
          </button>
        )}
      </div>

      {loading && rows.length > 0 && (
        <div className="text-sm text-neutral-500">Loading…</div>
      )}
    </div>
  );
}
