"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  id: number;
  title?: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at?: string | null;
};

export default function RequestsListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const res = await fetch("/api/requests", { cache: "no-store" });
    const json = await res.json();
    setRows(json.requests || []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Requests</h1>
      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-500">No requests.</div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">ID</th>
                <th className="text-left px-4 py-2">Title</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Created</th>
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
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString()
                      : "—"}
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
      )}
    </div>
  );
}
