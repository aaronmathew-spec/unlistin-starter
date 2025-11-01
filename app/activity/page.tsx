"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Act = {
  id: number;
  entity_type: "request" | "coverage" | "broker" | "file";
  entity_id: number;
  action: "create" | "update" | "status" | "delete" | "upload" | "download";
  meta: Record<string, unknown> | null;
  created_at: string;
};

export default function ActivityPage() {
  const [rows, setRows] = useState<Act[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // filters (client + server)
  const [entityType, setEntityType] = useState<"" | Act["entity_type"]>("");
  const [entityId, setEntityId] = useState<string>("");

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function fetchPage(cursor?: string | null) {
    const u = new URL("/api/activity", window.location.origin);
    u.searchParams.set("limit", "50");
    if (cursor) u.searchParams.set("cursor", cursor);
    if (entityType) u.searchParams.set("entity_type", entityType);
    if (entityId.trim()) u.searchParams.set("entity_id", entityId.trim());
    const res = await fetch(u.toString(), { cache: "no-store" });
    const j = await res.json().catch(() => ({} as any));
    return { list: (j.activity ?? []) as Act[], next: j.nextCursor ?? null };
  }

  async function refresh() {
    setLoading(true);
    try {
      const { list, next } = await fetchPage(null);
      if (!alive.current) return;
      setRows(list);
      setNextCursor(next);
    } finally {
      if (alive.current) setLoading(false);
    }
  }

  useEffect(() => {
    // refresh on filter change
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { list, next } = await fetchPage(nextCursor);
      if (!alive.current) return;
      setRows((prev) => [...prev, ...list]);
      setNextCursor(next);
    } finally {
      if (alive.current) setLoadingMore(false);
    }
  }

  // Local safeguard filtering in case the API ignores filters
  const filtered = useMemo(() => {
    const byType = entityType
      ? rows.filter((r) => r.entity_type === entityType)
      : rows;
    const byId = entityId.trim()
      ? byType.filter((r) => String(r.entity_id) === entityId.trim())
      : byType;
    return byId;
  }, [rows, entityType, entityId]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Activity</h1>

      <section className="border rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <select
          aria-label="Filter by entity type"
          value={entityType}
          onChange={(e) => setEntityType((e.target.value as any) || "")}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">All types</option>
          <option value="request">Request</option>
          <option value="coverage">Coverage</option>
          <option value="broker">Broker</option>
          <option value="file">File</option>
        </select>
        <input
          aria-label="Filter by entity id"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          placeholder="Entity ID (optional)"
          className="border rounded-lg px-3 py-2 min-w-[200px]"
        />
        {(entityType || entityId) && (
          <button
            onClick={() => {
              setEntityType("");
              setEntityId("");
            }}
            className="px-3 py-2 rounded-lg border hover:bg-gray-50"
          >
            Reset
          </button>
        )}
      </section>

      <section className="space-y-2">
        {loading ? (
          <div>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-600">No activity yet.</div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((a) => {
              const href =
                a.entity_type === "request"
                  ? `/requests/${a.entity_id}`
                  : a.entity_type === "coverage"
                  ? `/coverage/${a.entity_id}`
                  : a.entity_type === "broker"
                  ? `/brokers`
                  : undefined;

              return (
                <li
                  key={a.id}
                  className="border rounded p-3 text-sm flex items-start justify-between"
                >
                  <div className="pr-4">
                    <div className="font-medium">
                      {href ? (
                        <Link href={href} className="underline text-blue-600">
                          {prettyEntity(a.entity_type)} #{a.entity_id}
                        </Link>
                      ) : (
                        <>
                          {prettyEntity(a.entity_type)} #{a.entity_id}
                        </>
                      )}{" "}
                      — {prettyAction(a.action)}
                    </div>
                    {a.meta ? (
                      <pre className="mt-1 text-xs text-gray-600 whitespace-pre-wrap break-words">
                        {JSON.stringify(a.meta, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {nextCursor && (
          <div className="flex justify-center pt-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function prettyEntity(t: Act["entity_type"]) {
  switch (t) {
    case "request":
      return "Request";
    case "coverage":
      return "Coverage";
    case "broker":
      return "Broker";
    case "file":
      return "File";
  }
}
function prettyAction(a: Act["action"]) {
  switch (a) {
    case "create":
      return "Created";
    case "update":
      return "Updated";
    case "status":
      return "Status Changed";
    case "delete":
      return "Deleted";
    case "upload":
      return "Uploaded";
    case "download":
      return "Downloaded";
  }
}
