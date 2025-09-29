"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/providers/ToastProvider";

type ReqItem = {
  kind: "request";
  id: number;
  title: string | null;
  description: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  updated_at: string | null;
};
type CovItem = {
  kind: "coverage";
  id: number;
  broker_id: number;
  surface: string;
  note: string | null;
  status: "open" | "in_progress" | "resolved";
  updated_at: string | null;
};
type Item = ReqItem | CovItem;

export default function GlobalSearchPage() {
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [kRequests, setKRequests] = useState(true);
  const [kCoverage, setKCoverage] = useState(true);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [initial, setInitial] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: press "/" to focus the search bar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced search
  useEffect(() => {
    const id = setTimeout(() => {
      if (!q.trim()) {
        setItems([]);
        setCursor(null);
        setInitial(true);
        return;
      }
      setInitial(false);
      searchNow(null, true);
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kRequests, kCoverage]);

  async function searchNow(cur: string | null, replace = false) {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("q", q.trim());
      sp.set("limit", "25");
      if (cur) sp.set("cursor", cur);
      if (kRequests) sp.append("kind", "requests");
      if (kCoverage) sp.append("kind", "coverage");
      const url = `/api/search?` + sp.toString();
      const j = await fetch(url, { cache: "no-store" }).then((r) => r.json());
      if (replace) {
        setItems(j.items || []);
      } else {
        setItems((prev) => [...prev, ...(j.items || [])]);
      }
      setCursor(j.nextCursor ?? null);
    } catch (e: any) {
      toast(e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  const groups = useMemo(() => {
    const reqs: ReqItem[] = [];
    const covs: CovItem[] = [];
    for (const it of items) {
      if (it.kind === "request") reqs.push(it as ReqItem);
      else covs.push(it as CovItem);
    }
    return { reqs, covs };
  }, [items]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Search</h1>
        <Link href="/" className="px-3 py-1 rounded border hover:bg-gray-50">
          Dashboard
        </Link>
      </header>

      <section className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search… (press "/" to focus)'
            className="border rounded-lg px-3 py-2 w-full"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={kRequests}
              onChange={(e) => setKRequests(e.target.checked)}
            />
            Requests
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={kCoverage}
              onChange={(e) => setKCoverage(e.target.checked)}
            />
            Coverage
          </label>
          {(kRequests || kCoverage) ? null : (
            <span className="text-xs text-amber-600">
              Select at least one type to search
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              className="px-3 py-1 rounded border hover:bg-gray-50"
              disabled={!q.trim() || loading}
              onClick={() => searchNow(null, true)}
            >
              {loading ? "Searching…" : "Search"}
            </button>
            <button
              className="px-3 py-1 rounded border hover:bg-gray-50"
              onClick={() => {
                setQ("");
                setItems([]);
                setCursor(null);
                setInitial(true);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="space-y-6">
        {initial ? (
          <div className="text-gray-600">Type to search requests and coverage.</div>
        ) : items.length === 0 && !loading ? (
          <div className="text-gray-600">No results.</div>
        ) : (
          <>
            {groups.reqs.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Requests</div>
                <ul className="space-y-2">
                  {groups.reqs.map((r) => (
                    <li key={`req-${r.id}`} className="border rounded p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/requests/${r.id}`} className="font-medium underline">
                          #{r.id} {r.title || "Untitled"}
                        </Link>
                        <div className="text-xs text-gray-500">
                          {r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
                        </div>
                      </div>
                      <div className="mt-1 line-clamp-2 text-gray-700">
                        {r.description || "No description"}
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        Status: {r.status.replace("_", " ")}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {groups.covs.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Coverage</div>
                <ul className="space-y-2">
                  {groups.covs.map((c) => (
                    <li key={`cov-${c.id}`} className="border rounded p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/coverage/${c.id}`} className="font-medium underline">
                          #{c.id} {c.surface}
                        </Link>
                        <div className="text-xs text-gray-500">
                          {c.updated_at ? new Date(c.updated_at).toLocaleString() : "—"}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">Broker: {c.broker_id}</div>
                      {c.note && <div className="mt-1 line-clamp-2 text-gray-700">{c.note}</div>}
                      <div className="mt-1 text-xs text-gray-600">
                        Status: {c.status.replace("_", " ")}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {cursor && (
              <div className="flex justify-center">
                <button
                  className="px-3 py-1 rounded border hover:bg-gray-50"
                  disabled={loading}
                  onClick={() => searchNow(cursor, false)}
                >
                  {loading ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
