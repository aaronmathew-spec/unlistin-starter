// app/coverage/page.tsx
export const dynamic = "force-dynamic";
export const fetchCache = "default-no-store";

import Link from "next/link";

type CoverageRow = {
  id: number;
  request_id: number | null;
  score: number;
  files_count: number;
  exposure: number;
  created_at: string;
};

type CoveragePayload = { coverage: CoverageRow[]; nextCursor: string | null };

async function fetchCoverage(cursor?: string): Promise<CoveragePayload> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const path = cursor ? `/api/coverage?cursor=${encodeURIComponent(cursor)}` : "/api/coverage";
  const url = base ? new URL(path, base).toString() : path;

  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as CoveragePayload;
  } catch {
    // Graceful fallback keeps page usable even if API is offline
    return { coverage: [], nextCursor: null };
  }
}

export default async function CoveragePage() {
  const { coverage, nextCursor } = await fetchCoverage();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Coverage</h1>
        <Link href="/requests" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
          Back to Requests
        </Link>
      </div>

      {coverage.length === 0 ? (
        <div className="rounded-md border p-6 text-gray-600">
          No coverage snapshots yet. Open a request and upload files, then POST to
          <code className="mx-1 rounded bg-gray-100 px-1">/api/coverage</code> with
          <code className="ml-1 rounded bg-gray-100 px-1">{`{ request_id }`}</code>.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Request</th>
                <th className="px-3 py-2 text-left">Score</th>
                <th className="px-3 py-2 text-left">Files</th>
                <th className="px-3 py-2 text-left">Exposure</th>
                <th className="px-3 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{row.id}</td>
                  <td className="px-3 py-2">
                    {row.request_id ? (
                      <Link href={`/requests/${row.request_id}`} className="underline underline-offset-2">
                        {row.request_id}
                      </Link>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{row.score}</td>
                  <td className="px-3 py-2">{row.files_count}</td>
                  <td className="px-3 py-2">{row.exposure}</td>
                  <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <div className="mt-4 text-sm text-gray-600">More rows available… (paging UI coming next)</div>
      )}
    </div>
  );
}
