// app/requests/[id]/files/page.tsx

import type { Metadata } from "next";
import Link from "next/link";

// This page lists files for a request and should always be up-to-date
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Request Files",
};

type FileRow = {
  id: string;
  name: string;
  path: string | null;
  contentType: string | null;
  size: number | null;
  created_at: string;
  signedUrl: string | null;
};

function formatBytes(n: number | null | undefined) {
  if (!n || n <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let val = n;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

async function fetchFiles(requestId: string): Promise<FileRow[]> {
  // Prefer absolute URL if you set NEXT_PUBLIC_SITE_URL; otherwise use relative.
  const base =
    process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim() !== ""
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
      : "";

  const res = await fetch(`${base}/api/requests/${requestId}/files`, {
    // always fetch fresh signed URLs
    cache: "no-store",
  });

  if (!res.ok) {
    let msg = "Failed to load files";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as { files: FileRow[] };
  return data.files ?? [];
}

export default async function RequestFilesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const requestId = params.id;

  let files: FileRow[] = [];
  let error: string | null = null;

  try {
    files = await fetchFiles(requestId);
  } catch (e: any) {
    error = e?.message ?? "Failed to load files";
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Files</h1>
          <p className="text-sm text-gray-500">
            Request ID: <span className="font-mono">{requestId}</span>
          </p>
        </div>

        <div className="flex gap-2">
          {/* Simple refresh: add a timestamp param so the URL is unique and Next won't cache */}
          <Link
            href={`/requests/${requestId}/files?ts=${Date.now()}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Refresh
          </Link>
          <Link
            href={`/requests/${requestId}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Back to request
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-md border bg-white p-6 text-sm text-gray-600">
          No files uploaded for this request yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-white">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="border-b px-4 py-3 font-medium text-gray-700">Name</th>
                <th className="border-b px-4 py-3 font-medium text-gray-700">Size</th>
                <th className="border-b px-4 py-3 font-medium text-gray-700">Type</th>
                <th className="border-b px-4 py-3 font-medium text-gray-700">Uploaded</th>
                <th className="border-b px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="border-b px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{f.name ?? "file"}</span>
                      {f.path ? (
                        <span className="text-xs text-gray-500">{f.path}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="border-b px-4 py-3">{formatBytes(f.size)}</td>
                  <td className="border-b px-4 py-3">
                    {f.contentType ?? <span className="text-gray-400">unknown</span>}
                  </td>
                  <td className="border-b px-4 py-3">{formatDate(f.created_at)}</td>
                  <td className="border-b px-4 py-3">
                    {f.signedUrl ? (
                      <a
                        href={f.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        Download
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">no link</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
