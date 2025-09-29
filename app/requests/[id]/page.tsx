export const dynamic = "force-dynamic";
export const fetchCache = "default-no-store";

import Link from "next/link";
import CommentsSection from "./_components/CommentsSection";
import EventsSection from "./_components/EventsSection";
import StatusChanger from "./_components/StatusChanger";

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
  try {
    const r = await fetchJSON<{ request: RequestRow }>(`/api/requests/${id}`);
    return r.request;
  } catch {
    return { id, title: `Request #${id}`, description: null, status: "open" };
  }
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

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
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
