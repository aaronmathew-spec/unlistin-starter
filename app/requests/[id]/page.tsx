export const dynamic = "force-dynamic";
export const fetchCache = "default-no-store";

import Link from "next/link";

// ---- Types ----
type CommentRow = {
  id: number;
  request_id: number;
  user_id: string;
  body: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string | null;
};

type EventRow = {
  id: number;
  request_id: number;
  user_id: string;
  event_type: string;
  meta: any;
  created_at: string;
};

type RequestRow = {
  id: number;
  title?: string | null;
  description?: string | null;
  status?: string | null;
};

async function fetchJSON<T>(path: string) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

async function getInitial(id: number) {
  // Basic request info (reuse your existing API if you have one; fallback to page-local fetch)
  try {
    const r = await fetchJSON<{ request: RequestRow }>(`/api/requests/${id}`);
    return r.request;
  } catch {
    return { id, title: `Request #${id}`, description: null, status: "open" };
  }
}

// ---- Client components kept small and safe ----
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
  return fetchJSON<{ comments: CommentRow[]; nextCursor: string | null }>(
    `/api/requests/${id}/comments?limit=20`
  );
}
async function loadEvents(id: number) {
  return fetchJSON<{ events: EventRow[]; nextCursor: string | null }>(
    `/api/requests/${id}/events?limit=20`
  );
}

// Simple server action style POST using fetch from the client (no special hooks)
async function postComment(id: number, body: string) {
  const res = await fetch(`/api/requests/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ comment: CommentRow }>;
}
async function patchStatus(id: number, status: string) {
  const res = await fetch(`/api/requests/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ updated: boolean; status: string }>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border rounded-md p-4">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <div className="w-24 text-gray-500">{label}</div>
      <div className="flex-1">{value ?? <span className="text-gray-400">—</span>}</div>
    </div>
  );
}

"use client";
import { useEffect, useState, useTransition } from "react";

function CommentsSection({ requestId }: { requestId: number }) {
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
              // keep silent (no toasts in SSR)
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

function EventsSection({ requestId }: { requestId: number }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadEvents(requestId)
      .then(({ events }) => active && setEvents(events))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [requestId]);

  return (
    <Section title="Timeline">
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : events.length === 0 ? (
        <div className="text-sm text-gray-500">No events yet.</div>
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => (
            <li key={ev.id} className="text-sm">
              <div className="font-medium">{ev.event_type}</div>
              <div className="text-xs text-gray-500">{fromNow(ev.created_at)}</div>
              {ev.meta && Object.keys(ev.meta).length > 0 && (
                <pre className="mt-1 text-xs bg-gray-50 p-2 rounded border overflow-x-auto">
                  {JSON.stringify(ev.meta, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function StatusChanger({
  requestId,
  initial,
}: {
  requestId: number;
  initial?: string | null;
}) {
  const [status, setStatus] = useState(initial ?? "open");
  const [pending, start] = useTransition();

  const opts = ["open", "in_review", "approved", "changes_requested", "done", "archived"];

  return (
    <Section title="Status">
      <div className="flex items-center gap-2">
        <select
          className="border rounded px-2 py-1 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <button
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                const res = await patchStatus(requestId, status);
                if (!res.updated) {
                  // no-op
                }
              } catch {
                // no toasts in this build
              }
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </Section>
  );
}

// ---- Page (server) ----
export default async function RequestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  const request = await getInitial(id);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Request #{id} {request.title ? `— ${request.title}` : ""}
        </h1>
        <Link href="/requests" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
          Back
        </Link>
      </div>

      <Section title="Overview">
        <div className="space-y-2">
          <Field label="Title" value={request.title} />
          <Field label="Status" value={request.status} />
          <Field label="Description" value={request.description} />
        </div>
      </Section>

      <StatusChanger requestId={id} initial={request.status} />
      <CommentsSection requestId={id} />
      <EventsSection requestId={id} />
    </div>
  );
}
