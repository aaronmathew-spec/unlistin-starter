// app/ai/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";

/** =========================
 * Types
 * =======================*/
type ChatTurn = { role: "user" | "assistant"; content: string };

type RequestHit = {
  kind: "request";
  id: number;
  title: string | null;
  description: string | null;
  status: string | null;
  created_at: string;
};

type FileHit = {
  kind: "file";
  id: number;
  request_id: number;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
};

type SemanticHit = {
  kind: "request" | "file";
  ref_id: number;
  content: string;
  score: number;
};

type AssistResponse =
  | { answer: string; error?: undefined }
  | { answer?: undefined; error: string };

type KeywordSearchResponse = {
  requests?: RequestHit[];
  files?: FileHit[];
  error?: string;
};

type SemanticSearchResponse =
  | { matches: SemanticHit[]; error?: undefined }
  | { matches?: undefined; error: string };

type IndexResponse = { ok?: true; error?: string };

/** =========================
 * Helpers
 * =======================*/
function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** =========================
 * Page
 * =======================*/
export default function AIAssistPage() {
  // NOTE: NEXT_PUBLIC_* is inlined at build-time on client.
  const featureAI =
    (process.env.NEXT_PUBLIC_FEATURE_AI ?? "0").toString().trim() === "1";

  // Chat
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pendingChat, startChat] = useTransition();
  const chatRef = useRef<HTMLDivElement>(null);
  const chatAbort = useRef<AbortController | null>(null);

  // Keyword Search
  const [q, setQ] = useState("");
  const [pendingSearch, startSearch] = useTransition();
  const [reqHits, setReqHits] = useState<RequestHit[]>([]);
  const [fileHits, setFileHits] = useState<FileHit[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  // Semantic Search
  const [sq, setSQ] = useState("");
  const [pendingSemantic, startSemantic] = useTransition();
  const [semanticHits, setSemanticHits] = useState<SemanticHit[]>([]);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const semanticAbort = useRef<AbortController | null>(null);

  // Indexer
  const [pendingIndex, startIndex] = useTransition();
  const [indexMsg, setIndexMsg] = useState<string | null>(null);
  const indexAbort = useRef<AbortController | null>(null);

  const disabledReason = useMemo(() => {
    if (!featureAI) {
      return "AI UI disabled (set NEXT_PUBLIC_FEATURE_AI=1 to show)";
    }
    return null;
  }, [featureAI]);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  useEffect(() => {
    return () => {
      // cleanup any pending requests on unmount
      chatAbort.current?.abort();
      searchAbort.current?.abort();
      semanticAbort.current?.abort();
      indexAbort.current?.abort();
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Assist</h1>
        <Link href="/" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
          Home
        </Link>
      </div>

      {!featureAI ? (
        <div className="rounded-md border bg-amber-50 p-4 text-sm text-amber-800">
          {disabledReason}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* ===================== Chat ===================== */}
        <div className="flex flex-col gap-3">
          <div
            className="h-[60vh] overflow-y-auto rounded-md border bg-white p-4"
            ref={chatRef}
          >
            {turns.length === 0 ? (
              <div className="text-sm text-gray-500">
                Start a conversation below.
              </div>
            ) : (
              <ul className="space-y-3">
                {turns.map((t, i) => (
                  <li key={i} className="text-sm">
                    <div
                      className={t.role === "user" ? "font-medium" : "text-gray-700"}
                    >
                      {t.role === "user" ? "You" : "Assistant"}
                    </div>
                    <div className="whitespace-pre-wrap">{t.content}</div>
                  </li>
                ))}
              </ul>
            )}
            {pendingChat ? (
              <div className="mt-3 text-sm text-gray-400">Thinking…</div>
            ) : null}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const text = input.trim();
              if (!text || pendingChat) return;

              setTurns((prev) => [...prev, { role: "user", content: text }]);
              setInput("");

              // cancel any prior call
              chatAbort.current?.abort();
              chatAbort.current = new AbortController();

              startChat(async () => {
                try {
                  const res = await fetch("/api/ai/assist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      messages: [{ role: "user", content: text }],
                    }),
                    signal: chatAbort.current?.signal,
                  });
                  const json: AssistResponse = await res.json();
                  const content =
                    (json as AssistResponse).answer ??
                    (json as AssistResponse).error ??
                    "No response";
                  setTurns((prev) => [...prev, { role: "assistant", content }]);
                } catch (err: any) {
                  if (err?.name === "AbortError") return;
                  setTurns((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content: err?.message ?? "Failed to reach AI",
                    },
                  ]);
                } finally {
                  chatAbort.current = null;
                }
              });
            }}
          >
            <input
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              placeholder="Ask anything…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!!disabledReason}
            />
            <button
              type="submit"
              className={classNames(
                "rounded-md border px-3 py-2 text-sm hover:bg-gray-50",
                (disabledReason || pendingChat || !input.trim()) && "opacity-50"
              )}
              disabled={!!disabledReason || pendingChat || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>

        {/* Right column: Keyword + Semantic + Index controls */}
        <div className="flex flex-col gap-3">
          {/* ===================== Keyword Search ===================== */}
          <div className="rounded-md border bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Keyword Search</h2>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = q.trim();
                if (!text || pendingSearch) return;

                // cancel any prior call
                searchAbort.current?.abort();
                searchAbort.current = new AbortController();

                startSearch(async () => {
                  setSearchError(null);
                  try {
                    const res = await fetch(
                      `/api/ai/tools/search?q=${encodeURIComponent(text)}`,
                      { signal: searchAbort.current?.signal }
                    );
                    const json: KeywordSearchResponse = await res.json();
                    if (json.error) throw new Error(json.error);
                    setReqHits(json.requests ?? []);
                    setFileHits(json.files ?? []);
                  } catch (err: any) {
                    if (err?.name === "AbortError") return;
                    setSearchError(err?.message ?? "Search failed");
                    setReqHits([]);
                    setFileHits([]);
                  } finally {
                    searchAbort.current = null;
                  }
                });
              }}
            >
              <input
                className="flex-1 rounded-md border px-3 py-2 text-sm"
                placeholder="Search your requests and files…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                disabled={!!disabledReason}
              />
              <button
                type="submit"
                className={classNames(
                  "rounded-md border px-3 py-2 text-sm hover:bg-gray-50",
                  (disabledReason || pendingSearch || !q.trim()) && "opacity-50"
                )}
                disabled={!!disabledReason || pendingSearch || !q.trim()}
              >
                Search
              </button>
            </form>

            {pendingSearch && (
              <div className="mt-3 text-sm text-gray-400">Searching…</div>
            )}
            {searchError && (
              <div className="mt-3 text-sm text-red-600">Error: {searchError}</div>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <h3 className="mb-2 font-medium">Requests</h3>
                {reqHits.length === 0 ? (
                  <div className="text-sm text-gray-500">No matches.</div>
                ) : (
                  <ul className="space-y-2">
                    {reqHits.map((r) => (
                      <li key={`r-${r.id}`} className="rounded border p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">
                            #{r.id} {r.title ? `— ${r.title}` : ""}
                          </div>
                          <a
                            href={`/requests/${r.id}`}
                            className="text-xs underline hover:no-underline"
                          >
                            Open
                          </a>
                        </div>
                        {r.status && (
                          <div className="mt-1 text-xs text-gray-500">
                            Status: {r.status}
                          </div>
                        )}
                        {r.description && (
                          <div className="mt-1 line-clamp-3 text-xs text-gray-700">
                            {r.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-400">{fmtDate(r.created_at)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-medium">Files</h3>
                {fileHits.length === 0 ? (
                  <div className="text-sm text-gray-500">No matches.</div>
                ) : (
                  <ul className="space-y-2">
                    {fileHits.map((f) => (
                      <li key={`f-${f.id}`} className="rounded border p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{f.name}</div>
                          <a
                            href={`/requests/${f.request_id}`}
                            className="text-xs underline hover:no-underline"
                          >
                            Request #{f.request_id}
                          </a>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {f.mime ?? "unknown"} ·{" "}
                          {typeof f.size_bytes === "number"
                            ? `${f.size_bytes} bytes`
                            : "size n/a"}
                        </div>
                        <div className="text-xs text-gray-400">{fmtDate(f.created_at)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* ===================== Semantic Search ===================== */}
          <div className="rounded-md border bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Semantic Search (pgvector)</h2>
              <button
                className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                disabled={pendingIndex || !!disabledReason}
                onClick={() =>
                  startIndex(async () => {
                    setIndexMsg(null);

                    // cancel any prior call
                    indexAbort.current?.abort();
                    indexAbort.current = new AbortController();

                    try {
                      const res = await fetch("/api/ai/index", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reindexAll: true }),
                        signal: indexAbort.current?.signal,
                      });
                      const json: IndexResponse = await res.json();
                      if (!res.ok || json.error) {
                        throw new Error(json.error || "Reindex failed");
                      }
                      setIndexMsg("Reindex complete.");
                    } catch (e: any) {
                      if (e?.name === "AbortError") return;
                      setIndexMsg(`Reindex error: ${e?.message ?? "unknown"}`);
                    } finally {
                      indexAbort.current = null;
                    }
                  })
                }
              >
                {pendingIndex ? "Reindexing…" : "Reindex My Data"}
              </button>
            </div>
            {indexMsg && <div className="mb-2 text-xs text-gray-600">{indexMsg}</div>}

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = sq.trim();
                if (!text || pendingSemantic) return;

                // cancel any prior call
                semanticAbort.current?.abort();
                semanticAbort.current = new AbortController();

                startSemantic(async () => {
                  setSemanticError(null);
                  try {
                    const res = await fetch("/api/ai/search", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        query: text,
                        limit: 10,
                        kinds: ["request", "file"],
                      }),
                      signal: semanticAbort.current?.signal,
                    });
                    const json: SemanticSearchResponse = await res.json();
                    if ("error" in json && json.error) throw new Error(json.error);
                    setSemanticHits(json.matches ?? []);
                  } catch (err: any) {
                    if (err?.name === "AbortError") return;
                    setSemanticError(err?.message ?? "Semantic search failed");
                    setSemanticHits([]);
                  } finally {
                    semanticAbort.current = null;
                  }
                });
              }}
            >
              <input
                className="flex-1 rounded-md border px-3 py-2 text-sm"
                placeholder="Ask semantically (e.g., 'design decisions for file uploads')…"
                value={sq}
                onChange={(e) => setSQ(e.target.value)}
                disabled={!!disabledReason}
              />
              <button
                type="submit"
                className={classNames(
                  "rounded-md border px-3 py-2 text-sm hover:bg-gray-50",
                  (disabledReason || pendingSemantic || !sq.trim()) && "opacity-50"
                )}
                disabled={!!disabledReason || pendingSemantic || !sq.trim()}
              >
                Search
              </button>
            </form>

            {pendingSemantic && (
              <div className="mt-3 text-sm text-gray-400">Searching…</div>
            )}
            {semanticError && (
              <div className="mt-3 text-sm text-red-600">
                Error: {semanticError}
              </div>
            )}

            <div className="mt-4">
              {semanticHits.length === 0 ? (
                <div className="text-sm text-gray-500">No semantic matches yet.</div>
              ) : (
                <ul className="space-y-2">
                  {semanticHits.map((m, i) => (
                    <li key={i} className="rounded border p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          {m.kind === "request" ? "Request" : "File"} #{m.ref_id}
                        </div>
                        <a
                          href={
                            m.kind === "request"
                              ? `/requests/${m.ref_id}`
                              : `/requests/${m.ref_id}`
                          }
                          className="text-xs underline hover:no-underline"
                        >
                          Open
                        </a>
                      </div>
                      <div className="text-xs text-gray-500">
                        score: {m.score.toFixed(3)}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-xs text-gray-700">
                        {m.content}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-500">
            RLS is enforced end-to-end. Embedding dimension: 1536 (text-embedding-3-small).
            We’ll add file content extraction & SQL-ordered ANN next.
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Flags: <code>FEATURE_AI_SERVER</code> governs backend availability;{" "}
        <code>NEXT_PUBLIC_FEATURE_AI</code> shows this UI.
      </p>
    </div>
  );
}
