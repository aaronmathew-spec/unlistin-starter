"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";

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

export default function AIAssistPage() {
  const featureAI = process.env.NEXT_PUBLIC_FEATURE_AI === "1";

  // Chat
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pendingChat, startChat] = useTransition();
  const chatRef = useRef<HTMLDivElement>(null);

  // Keyword Search
  const [q, setQ] = useState("");
  const [pendingSearch, startSearch] = useTransition();
  const [reqHits, setReqHits] = useState<RequestHit[]>([]);
  const [fileHits, setFileHits] = useState<FileHit[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Semantic Search
  const [sq, setSQ] = useState("");
  const [pendingSemantic, startSemantic] = useTransition();
  const [semanticHits, setSemanticHits] = useState<SemanticHit[]>([]);
  const [semanticError, setSemanticError] = useState<string | null>(null);

  // Indexer
  const [pendingIndex, startIndex] = useTransition();
  const [indexMsg, setIndexMsg] = useState<string | null>(null);

  const disabledReason = useMemo(() => {
    if (!featureAI) return "AI UI disabled (set NEXT_PUBLIC_FEATURE_AI=1 to show)";
    return null;
  }, [featureAI]);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Assist</h1>
        <Link href="/" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
          Home
        </Link>
      </div>

      {!featureAI ? (
        <div className="border rounded-md p-4 bg-amber-50 text-amber-800 text-sm">
          {disabledReason}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chat */}
        <div className="flex flex-col gap-3">
          <div className="border rounded-md p-4 h-[60vh] overflow-y-auto bg-white" ref={chatRef}>
            {turns.length === 0 ? (
              <div className="text-sm text-gray-500">Start a conversation below.</div>
            ) : (
              <ul className="space-y-3">
                {turns.map((t, i) => (
                  <li key={i} className="text-sm">
                    <div className={t.role === "user" ? "font-medium" : "text-gray-700"}>
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

              startChat(async () => {
                try {
                  const res = await fetch("/api/ai/assist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      messages: [{ role: "user", content: text }],
                    }),
                  });
                  const json = (await res.json()) as { answer?: string; error?: string };
                  const content = json.answer ?? json.error ?? "No response";
                  setTurns((prev) => [...prev, { role: "assistant", content }]);
                } catch (err: any) {
                  setTurns((prev) => [
                    ...prev,
                    { role: "assistant", content: err?.message ?? "Failed to reach AI" },
                  ]);
                }
              });
            }}
          >
            <input
              className="flex-1 border rounded-md px-3 py-2 text-sm"
              placeholder="Ask anything…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!!disabledReason}
            />
            <button
              type="submit"
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={!!disabledReason || pendingChat || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>

        {/* Right column: Keyword + Semantic + Index controls */}
        <div className="flex flex-col gap-3">
          {/* Keyword Search */}
          <div className="border rounded-md p-4 bg-white">
            <h2 className="text-lg font-semibold mb-3">Keyword Search</h2>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = q.trim();
                if (!text || pendingSearch) return;

                startSearch(async () => {
                  setSearchError(null);
                  try {
                    const res = await fetch(`/api/ai/tools/search?q=${encodeURIComponent(text)}`);
                    const json = (await res.json()) as {
                      requests?: RequestHit[];
                      files?: FileHit[];
                      error?: string;
                    };
                    if (json.error) throw new Error(json.error);
                    setReqHits(json.requests ?? []);
                    setFileHits(json.files ?? []);
                  } catch (err: any) {
                    setSearchError(err?.message ?? "Search failed");
                    setReqHits([]);
                    setFileHits([]);
                  }
                });
              }}
            >
              <input
                className="flex-1 border rounded-md px-3 py-2 text-sm"
                placeholder="Search your requests and files…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                disabled={!!disabledReason}
              />
              <button
                type="submit"
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={!!disabledReason || pendingSearch || !q.trim()}
              >
                Search
              </button>
            </form>

            {pendingSearch && <div className="mt-3 text-sm text-gray-400">Searching…</div>}
            {searchError && <div className="mt-3 text-sm text-red-600">Error: {searchError}</div>}

            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-medium mb-2">Requests</h3>
                {reqHits.length === 0 ? (
                  <div className="text-sm text-gray-500">No matches.</div>
                ) : (
                  <ul className="space-y-2">
                    {reqHits.map((r) => (
                      <li key={`r-${r.id}`} className="text-sm border rounded p-2">
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
                          <div className="text-xs text-gray-500 mt-1">Status: {r.status}</div>
                        )}
                        {r.description && (
                          <div className="text-xs text-gray-700 mt-1 line-clamp-3">
                            {r.description}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="font-medium mb-2">Files</h3>
                {fileHits.length === 0 ? (
                  <div className="text-sm text-gray-500">No matches.</div>
                ) : (
                  <ul className="space-y-2">
                    {fileHits.map((f) => (
                      <li key={`f-${f.id}`} className="text-sm border rounded p-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{f.name}</div>
                          <a
                            href={`/requests/${f.request_id}`}
                            className="text-xs underline hover:no-underline"
                          >
                            Request #{f.request_id}
                          </a>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {f.mime ?? "unknown"} ·{" "}
                          {typeof f.size_bytes === "number" ? `${f.size_bytes} bytes` : "size n/a"}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(f.created_at).toLocaleString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Semantic Search */}
          <div className="border rounded-md p-4 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold mb-3">Semantic Search (pgvector)</h2>
              <button
                className="text-xs rounded border px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                disabled={pendingIndex || !!disabledReason}
                onClick={() =>
                  startIndex(async () => {
                    setIndexMsg(null);
                    try {
                      const res = await fetch("/api/ai/index", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reindexAll: true }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || "Failed");
                      setIndexMsg("Reindex complete.");
                    } catch (e: any) {
                      setIndexMsg(`Reindex error: ${e?.message ?? "unknown"}`);
                    }
                  })
                }
              >
                {pendingIndex ? "Reindexing…" : "Reindex My Data"}
              </button>
            </div>
            {indexMsg && <div className="text-xs text-gray-600 mb-2">{indexMsg}</div>}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = sq.trim();
                if (!text || pendingSemantic) return;

                startSemantic(async () => {
                  setSemanticError(null);
                  try {
                    const res = await fetch("/api/ai/search", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ query: text, limit: 10, kinds: ["request", "file"] }),
                    });
                    const json = (await res.json()) as { matches?: SemanticHit[]; error?: string };
                    if (json.error) throw new Error(json.error);
                    setSemanticHits(json.matches ?? []);
                  } catch (err: any) {
                    setSemanticError(err?.message ?? "Semantic search failed");
                    setSemanticHits([]);
                  }
                });
              }}
            >
              <input
                className="flex-1 border rounded-md px-3 py-2 text-sm"
                placeholder="Ask semantically (e.g., 'design decisions for file uploads')…"
                value={sq}
                onChange={(e) => setSQ(e.target.value)}
                disabled={!!disabledReason}
              />
              <button
                type="submit"
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={!!disabledReason || pendingSemantic || !sq.trim()}
              >
                Search
              </button>
            </form>

            {pendingSemantic && <div className="mt-3 text-sm text-gray-400">Searching…</div>}
            {semanticError && <div className="mt-3 text-sm text-red-600">Error: {semanticError}</div>}

            <div className="mt-4">
              {semanticHits.length === 0 ? (
                <div className="text-sm text-gray-500">No semantic matches yet.</div>
              ) : (
                <ul className="space-y-2">
                  {semanticHits.map((m, i) => (
                    <li key={i} className="text-sm border rounded p-2">
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
                      <div className="text-xs text-gray-500">score: {m.score.toFixed(3)}</div>
                      <div className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">
                        {m.content}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-500">
            RLS is enforced end-to-end. Embedding dimension: 1536 (text-embedding-3-small). We’ll add
            file content extraction & SQL-ordered ANN next.
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
