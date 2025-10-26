/* eslint-disable @typescript-eslint/no-explicit-any */
import { envBool } from "@/lib/env";
import type { FileHit, RequestHit } from "@/types/ai";

export const runtime = "nodejs"; // node runtime is safest for future DB/search wiring

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

/**
 * Keyword search placeholder.
 * - Returns small demo results (when q is present) so wiring is visible end-to-end.
 * - Once you wire Supabase/FTS, replace the demo block with a real query.
 * - Feature-gated via FEATURE_AI_SERVER (defaults to enabled).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const topK = Math.max(1, Math.min(25, Number(url.searchParams.get("topK") ?? "10")));

  // Gate with env flag (set FEATURE_AI_SERVER=0 to hide endpoint responses in prod if desired)
  const enabled = envBool("FEATURE_AI_SERVER", true);
  if (!enabled) {
    return json({ requests: [], files: [] }, { status: 200 });
  }

  // --- Demo results: shown only when a non-empty query is provided ---
  if (!q) {
    return json({ requests: [], files: [] });
  }

  const nowIso = new Date().toISOString();

  // Create a couple of deterministic demo results so UI can render reliably
  const demoRequests: RequestHit[] = Array.from({ length: Math.min(1, topK) }).map((_, i) => ({
    kind: "request",
    id: 100 + i,
    title: `Demo: “${q}” request #${i + 1}`,
    description: "Replace this with Supabase FTS across requests/request_files.",
    status: "open",
    created_at: nowIso,
  }));

  const demoFiles: FileHit[] = Array.from({ length: Math.min(1, topK) }).map((_, i) => ({
    kind: "file",
    id: 9000 + i,
    request_id: demoRequests[0]?.id ?? 100,
    name: `demo-${q.replace(/\s+/g, "-").toLowerCase()}-${i + 1}.pdf`,
    mime: "application/pdf",
    size_bytes: 256_000 + i * 1024,
    created_at: nowIso,
  }));

  // --- Real implementation (when ready) ---
  // 1) Use a server-side Supabase client (node runtime) with service role or RLS-scoped session.
  // 2) Perform FTS (tsvector) over:
  //    - requests(title, description)
  //    - request_files(name, optional extracted text)
  // 3) Map rows into RequestHit/FileHit and return below.

  return json({ requests: demoRequests, files: demoFiles });
}
