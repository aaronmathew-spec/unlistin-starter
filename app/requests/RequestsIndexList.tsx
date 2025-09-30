"use client";

import { useEffect, useState } from "react";

type ReqRow = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
};

export default function RequestsIndexList() {
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const PAGE = 20;

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
      qs.set("dir", "desc");
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

  useEffect(() => {
    fetchPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Requests</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPage({ reset: true })}
            className="rounded-md border px-3 py-1 text-sm hover:bg-neutral-50"
          >
            Refresh
          </button>
          {hasMore && (
            <button
              onClick={() => fetchPage()}
              className="rounded-md border px-3 py-1 text-sm hover:bg-neutral-50"
              disabled={loading}
            >
              Load more
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="rounded-md border p-3 text-sm text-neutral-600">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border p-3 text-sm text-neutral-600">No requests yet.</div>
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

      {loading && rows.length > 0 && (
        <div className="text-sm text-neutral-500">Loading…</div>
      )}
    </div>
  );
}
