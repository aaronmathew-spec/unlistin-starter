"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Hit = {
  id: string;
  source: "request" | "file";
  title: string;
  snippet: string;
  score: number;
};

export default function AISearchPanel() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  const featureOn = useMemo(
    () => process.env.NEXT_PUBLIC_FEATURE_AI === "1",
    []
  );

  const doSearch = useCallback(
    async (query: string) => {
      if (!featureOn) return;
      if (!query.trim()) {
        setHits([]);
        return;
      }

      // Cancel any in-flight request
      controllerRef.current?.abort();
      const ac = new AbortController();
      controllerRef.current = ac;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/ai/search", {
          method: "POST",
          body: JSON.stringify({ q: query, limit: 10 }),
          headers: { "content-type": "application/json" },
          signal: ac.signal,
        });

        const data = (await res.json()) as
          | { ok: true; results: Hit[] }
          | { ok: false; error: string };

        if ("ok" in data && data.ok) {
          setHits(data.results);
        } else {
          setError(data.error ?? "Search failed");
        }
      } catch (err: unknown) {
        if ((err as any)?.name !== "AbortError") {
          setError("Search aborted or failed");
        }
      } finally {
        setLoading(false);
      }
    },
    [featureOn]
  );

  // Simple debounce
  useEffect(() => {
    const t = setTimeout(() => {
      void doSearch(q);
    }, 250);
    return () => clearTimeout(t);
  }, [q, doSearch]);

  if (!featureOn) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border p-6">
        <h2 className="text-xl font-semibold">AI Search</h2>
        <p className="mt-2 text-sm text-gray-600">
          The AI UI is currently disabled. Flip{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5">
            NEXT_PUBLIC_FEATURE_AI=1
          </code>{" "}
          in your Vercel Environment Variables when you’re ready.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-xl border p-4">
        <label className="block text-sm font-medium">Search</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about requests, files, exposures…"
          className="mt-2 w-full rounded-lg border px-3 py-2 outline-none focus:ring"
        />
        <div className="mt-2 text-xs text-gray-500">
          Queries are sent to <code>/api/ai/search</code>. Results are placeholder
          until the vector index is wired.
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Results</h3>
          {loading && <span className="text-xs text-gray-500">Searching…</span>}
        </div>

        {!!error && (
          <div className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && hits.length === 0 && q.trim() !== "" && (
          <div className="mt-3 text-sm text-gray-600">No matches.</div>
        )}

        <ul className="mt-3 space-y-3">
          {hits.map((h) => (
            <li key={h.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{h.title}</div>
                <span className="text-xs text-gray-500">
                  {h.source} · {h.score.toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-700 line-clamp-3">
                {h.snippet}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
