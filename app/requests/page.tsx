"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/toast";

type Row = {
  id: number;
  title?: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at?: string | null;
  updated_at?: string | null;
};

const STATUS_OPTIONS: Array<{ value: "" | Row["status"]; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function RequestsListPage() {
  const { push } = useToast();

  // table state
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | Row["status"]>("");

  // debounced search term
  const [debouncedQ, setDebouncedQ] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // debounce q changes
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQ(q.trim());
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [q]);

  const fetchPage = async (cursor?: string | null, opts?: { replace?: boolean }) => {
    const u = new URL("/api/requests", window.location.origin);
    u.searchParams.set("limit", "20");
    if (cursor) u.searchParams.set("cursor", cursor);
    if (debouncedQ) u.searchParams.set("q", debouncedQ);
    if (status) u.searchParams.set("status", status);

    const res = await fetch(u.toString(), { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      push({ message: json?.error || "Failed to load requests", type: "error" });
      return { items: [] as Row[], next: null as string | null, replace: !!opts?.replace };
    }
    return {
      items: (json.requests || []) as Row[],
      next: json.nextCursor ?? null,
      replace: !!opts?.replace,
    };
  };

  // initial load + when filters change, reset paging
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { items, next } = await fetchPage(null, { replace: true });
      if (cancelled) return;
      setRows(items);
      setNextCursor(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status]);

  const loadMore = async () => {
    if (!nextCursor) return;
    const { items, next } = await fetchPage(nextCursor);
    setRows((prev) => [...prev, ...items]);
    setNextCursor(next);
  };

  const hasActiveFilters = useMemo(() => !!debouncedQ || !!status, [debouncedQ, status]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Requests</h1>
        <Link
          href="/requests/new"
          className="px-3 py-1.5 rounded-md border hover:bg-gray-50"
        >
          New request
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or description…"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="border rounded-lg px-3 py-2"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button
            onClick={() => {
              setQ("");
              setStatus("");
            }}
            className="px-3 py-2 rounded-lg border hover:bg-gray-50"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-500">
          {hasActiveFilters ? "No results match your filters." : "No requests yet."}
        </div>
      ) : (
        <>
          <div className="rounded-xl border overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2">ID</th>
                  <th className="text-left px-4 py-2">Title</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Created</th>
                  <th className="text-left px-4 py-2">Updated</th>
                  <th className="text-right px-4 py-2">Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2">{r.id}</td>
                    <td className="px-4 py-2">{r.title ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-1 rounded-full bg-gray-100">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/requests/${r.id}`}
                        className="px-3 py-1 rounded-md border hover:bg-gray-50"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div className="flex justify-center mt-4">
              <button
                onClick={loadMore}
                className="px-4 py-2 rounded-lg border hover:bg-gray-50"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
