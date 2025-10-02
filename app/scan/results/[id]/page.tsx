// app/scan/results/[id]/page.tsx
export const runtime = "nodejs";

import Link from "next/link";

async function getData(id: number) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/scan/runs/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    run: { id: number; created_at: string; status: string; query_preview: any; took_ms: number };
    hits: Array<{
      id: number; rank: number; broker: string; category: string;
      url: string; confidence: number; matched_fields: string[]; evidence: string[];
    }>;
  }>;
}

export default async function ScanResultPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) throw new Error("Invalid id");
  const { run, hits } = await getData(id);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Scan Results #{run.id}</h1>
        <Link href="/scan/quick" className="px-3 py-1 rounded border hover:bg-gray-50 text-sm">
          Run another scan
        </Link>
      </div>

      <div className="rounded-xl border bg-white p-4 text-sm">
        <div className="text-gray-600">Query preview (redacted)</div>
        <pre className="mt-1 text-xs text-gray-700">{JSON.stringify(run.query_preview, null, 2)}</pre>
        <div className="mt-2 text-xs text-gray-500">
          Status: {run.status} • Took {(run.took_ms / 1000).toFixed(2)}s •{" "}
          Created {new Date(run.created_at).toLocaleString()}
        </div>
      </div>

      {hits.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
          No hits saved for this run.
        </div>
      ) : (
        <div className="space-y-3">
          {hits.map(h => <HitCard key={h.id} h={h} />)}
        </div>
      )}
    </div>
  );
}

function HitCard({ h }: { h: {
  id: number; rank: number; broker: string; category: string;
  url: string; confidence: number; matched_fields: string[]; evidence: string[];
} }) {
  const pct = Math.round(h.confidence * 100);
  const band =
    pct >= 80 ? "bg-emerald-100 text-emerald-800" :
    pct >= 50 ? "bg-amber-100 text-amber-800" :
                "bg-gray-100 text-gray-700";
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500">{h.category}</div>
          <a href={h.url} target="_blank" rel="noreferrer" className="font-medium underline">
            {h.broker}
          </a>
          <div className="mt-1 text-xs text-gray-600">
            Matched: {h.matched_fields.join(", ")}
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${band}`}>Confidence {pct}%</span>
      </div>
      {h.evidence?.length ? (
        <ul className="mt-3 list-disc ml-5 text-xs text-gray-700 space-y-1">
          {h.evidence.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
