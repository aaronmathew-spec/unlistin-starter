"use client";

import { useEffect, useState, useTransition } from "react";

type CommentRow = {
  id: number;
  request_id: number;
  user_id: string;
  body: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string | null;
};

function fromNow(d: string) {
  try {
    const ms = Date.now() - new Date(d).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
  } catch {
    return d;
  }
}

async function loadComments(id: number) {
  const res = await fetch(`/api/requests/${id}/comments?limit=20`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { comments: CommentRow[]; nextCursor: string | null };
}

async function postComment(id: number, body: string) {
  const res = await fetch(`/api/requests/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { comment: CommentRow };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border rounded-md p-4">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function CommentsSection({ requestId }: { requestId: number }) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, startPost] = useTransition();

  useEffect(() => {
    let active = true;
    loadComments(requestId)
      .then(({ comments }) => active && setComments(comments))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [requestId]);

  return (
    <Section title="Comments">
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : comments.length === 0 ? (
        <div className="text-sm text-gray-500">No comments yet.</div>
      ) : (
        <ul className="space-y-3 mb-4">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="text-gray-800 whitespace-pre-wrap">{c.body}</div>
              <div className="text-xs text-gray-500">{fromNow(c.created_at)}</div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const text = body.trim();
          if (!text) return;
          startPost(async () => {
            try {
              const { comment } = await postComment(requestId, text);
              setComments((prev) => [comment, ...prev]);
              setBody("");
            } catch {
              // graceful no-toast failure in SSR builds
            }
          });
        }}
        className="flex gap-2"
      >
        <textarea
          className="flex-1 border rounded-md p-2 text-sm"
          rows={2}
          placeholder="Write a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="submit"
          disabled={posting || !body.trim()}
          className="self-start rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </form>
    </Section>
  );
}
