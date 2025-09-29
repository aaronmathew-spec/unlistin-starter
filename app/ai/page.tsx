"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";

type ChatTurn = { role: "user" | "assistant"; content: string };

export default function AIAssistPage() {
  // gate the UI via public flag so it can be dark-deployed
  const featureAI = process.env.NEXT_PUBLIC_FEATURE_AI === "1";

  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, start] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const disabledReason = useMemo(() => {
    if (!featureAI) return "AI UI disabled (set NEXT_PUBLIC_FEATURE_AI=1 to show)";
    return null;
  }, [featureAI]);

  useEffect(() => {
    // autoscroll on new messages
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
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

      <div className="border rounded-md p-4 h-[60vh] overflow-y-auto bg-white" ref={scrollerRef}>
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
        {pending ? (
          <div className="mt-3 text-sm text-gray-400">Thinking…</div>
        ) : null}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text || pending) return;

          setTurns((prev) => [...prev, { role: "user", content: text }]);
          setInput("");

          start(async () => {
            try {
              const res = await fetch("/api/ai/assist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: [
                    { role: "user", content: text },
                    // You could include the whole history here; keeping it short at first.
                  ],
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
          disabled={!!disabledReason || pending || !input.trim()}
        >
          Send
        </button>
      </form>

      <p className="text-xs text-gray-500">
        Tip: Keep <code>FEATURE_AI_SERVER</code> and <code>NEXT_PUBLIC_FEATURE_AI</code> at 0 until
        after deploy. Then flip <code>FEATURE_AI_SERVER</code> first (backend), verify, and finally
        <code> NEXT_PUBLIC_FEATURE_AI</code> to reveal the UI.
      </p>
    </div>
  );
}
