"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/toast";

type Row = {
  id: number;
  title?: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at?: string | null;
  updated_at?: string | null;
};

export default function RequestsListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const { push } = useToast();

  const fetchPage = async (cursor?: string | null) => {
    const u = new URL("/api/requests", window.location.origin);
    u.searchParams.set("limit", "20");
    if (cursor) u.searchParams.set("cursor", cursor);
    const res = await fetch(u.toString(), { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      push({ message: json?.error || "Failed to load requests", type: "error" });
      return { items: [] as Row[], next: null as string | null };
    }
    return { items: (json.requests || []) as Row[], next: json.nextCursor ?? null };
  };

  const refresh = async () => {
    setLoading(true);
    const { items, next } = await fetchPage(null);
    setRows(items);
    setNextCursor(next);
    setLoading(false);
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    const { items, next } = await fetchPage(nextCursor);
    setRows((prev) => [...prev, ...items]);
    setNextCursor(next);
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Requests</h1>
      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-500">No requests.</div>
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
                      <span className="px-2 py-1 rounded-full bg-gray-100">{r.status}</span>
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
