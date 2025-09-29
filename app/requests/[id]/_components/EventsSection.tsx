"use client";

import { useEffect, useState } from "react";

type EventRow = {
  id: number;
  request_id: number;
  user_id: string;
  event_type: string;
  meta: any;
  created_at: string;
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

async function loadEvents(id: number) {
  const res = await fetch(`/api/requests/${id}/events?limit=20`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { events: EventRow[]; nextCursor: string | null };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border rounded-md p-4">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function EventsSection({ requestId }: { requestId: number }) {
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
