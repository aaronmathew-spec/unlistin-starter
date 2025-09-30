"use client";

import { useEffect, useState } from "react";

type EventRow = {
  id: number;
  request_id: number;
  type: string | null;
  message: string | null;
  created_at: string;
};

type CommentRow = {
  id: number;
  request_id: number;
  body: string;
  created_at: string;
  user_id?: string | null;
};

export default function ActivityTab({ requestId }: { requestId: number }) {
  // events
  const [events, setEvents] = useState<EventRow[]>([]);
  const [evCursor, setEvCursor] = useState<string | null>(null);
  const [evHasMore, setEvHasMore] = useState(true);
  const [evLoading, setEvLoading] = useState(true);
  const [evErr, setEvErr] = useState<string | null>(null);

  // comments
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [cmCursor, setCmCursor] = useState<string | null>(null);
  const [cmHasMore, setCmHasMore] = useState(true);
  const [cmLoading, setCmLoading] = useState(true);
  const [cmErr, setCmErr] = useState<string | null>(null);

  const [newBody, setNewBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState<string | null>(null);

  async function loadEvents(reset?: boolean) {
    if (reset) {
      setEvents([]);
      setEvCursor(null);
      setEvHasMore(true);
      setEvErr(null);
      setEvLoading(true);
    }
    try {
      const qs = new URLSearchParams();
      if (!reset && evCursor) qs.set("cursor", evCursor);
      const res = await fetch(`/api/requests/${requestId}/events?` + qs.toString(), {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load events");
      setEvents((cur) => (reset ? data.events : cur.concat(data.events)));
      setEvCursor(data.nextCursor ?? null);
      setEvHasMore(Boolean(data.nextCursor));
    } catch (e: any) {
      setEvErr(e?.message ?? "Failed to load events");
    } finally {
      setEvLoading(false);
    }
  }

  async function loadComments(reset?: boolean) {
    if (reset) {
      setComments([]);
      setCmCursor(null);
      setCmHasMore(true);
      setCmErr(null);
      setCmLoading(true);
    }
    try {
      const qs = new URLSearchParams();
      if (!reset && cmCursor) qs.set("cursor", cmCursor);
      const res = await fetch(`/api/requests/${requestId}/comments?` + qs.toString(), {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load comments");
      setComments((cur) => (reset ? data.comments : cur.concat(data.comments)));
      setCmCursor(data.nextCursor ?? null);
      setCmHasMore(Boolean(data.nextCursor));
    } catch (e: any) {
      setCmErr(e?.message ?? "Failed to load comments");
    } finally {
      setCmLoading(false);
    }
  }

  useEffect(() => {
    loadEvents(true);
    loadComments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function postComment() {
    const text = newBody.trim();
    if (!text) return;
    setPosting(true);
    setPostErr(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to post");
      setNewBody("");
      // Reload comments (reset to see newest at top)
      await loadComments(true);
    } catch (e: any) {
      setPostErr(e?.message ?? "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <div className="text-sm font-semibold">Events</div>
        {evErr && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {evErr}
          </div>
        )}
        <div className="rounded-md border">
          {events.length === 0 && !evLoading ? (
            <div className="p-3 text-sm text-neutral-500">No events yet.</div>
          ) : (
            <ul className="divide-y">
              {events.map((e) => (
                <li key={e.id} className="p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{e.type || "event"}</div>
                    <div className="text-xs text-neutral-500">
                      {new Date(e.created_at).toLocaleString()}
                    </div>
                  </div>
                  {e.message && <div className="text-neutral-600">{e.message}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-neutral-500">
            {events.length} loaded {evHasMore ? "— more available" : "— end"}
          </div>
          {evHasMore && (
            <button
              onClick={() => loadEvents(false)}
              className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
            >
              Load more
            </button>
          )}
        </div>
        {evLoading && events.length > 0 && (
          <div className="text-sm text-neutral-500">Loading…</div>
        )}
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold">Comments</div>
        {(cmErr || postErr) && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {cmErr || postErr}
          </div>
        )}
        <div className="rounded-md border">
          {comments.length === 0 && !cmLoading ? (
            <div className="p-3 text-sm text-neutral-500">No comments yet.</div>
          ) : (
            <ul className="divide-y">
              {comments.map((c) => (
                <li key={c.id} className="p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {c.user_id ? `User ${c.user_id.slice(0, 6)}…` : "Someone"}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {new Date(c.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-neutral-700">{c.body}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-neutral-500">
            {comments.length} loaded {cmHasMore ? "— more available" : "— end"}
          </div>
          {cmHasMore && (
            <button
              onClick={() => loadComments(false)}
              className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
            >
              Load more
            </button>
          )}
        </div>
        {cmLoading && comments.length > 0 && (
          <div className="text-sm text-neutral-500">Loading…</div>
        )}

        <div className="rounded-md border p-3">
          <div className="mb-2 text-xs text-neutral-500">Add a comment</div>
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            className="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
            maxLength={5000}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={postComment}
              disabled={posting || !newBody.trim()}
              className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              {posting ? "Posting…" : "Post comment"}
            </button>
            <div className="text-xs text-neutral-500">{newBody.trim().length}/5000</div>
          </div>
        </div>
      </div>
    </div>
  );
}
