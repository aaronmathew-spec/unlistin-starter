/* eslint-disable @typescript-eslint/no-explicit-any */
import { envBool } from "@/lib/env";
import type { FileHit, RequestHit } from "@/types/ai";

export const runtime = "nodejs"; // supabase-js + node-only libs prefer node runtime

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
 * - Returns empty arrays with a short note until you plug real DB search.
 * - Never breaks builds. Matches the shape your AI page expects.
 *
 * Later: Replace the stub with a Supabase FTS query (tsvector) across:
 *   - requests (title, description)
 *   - request_files (name, optional extracted text)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();

  // Ship even if FEATURE_AI_SERVER=0; keyword search is safe to show.
  // If you prefer to gate it, uncomment the check below:
  // if (!envBool(process.env.FEATURE_AI_SERVER)) {
  //   return json({ error: "Server AI disabled", requests: [], files: [] }, { status: 200 });
  // }

  // Very small, safe “demo” results if a query is present, to prove wiring works.
  // Comment these three lines if you want strictly empty results until DB is wired.
  const hasQuery = q.length > 0;
  const demoRequests: RequestHit[] = hasQuery
    ? [
        {
          kind: "request",
          id: 101,
          title: "Account removal process",
          description: "Steps to remove stale data and revoke broker permissions.",
          status: "open",
          created_at: new Date().toISOString(),
        },
      ]
    : [];

  const demoFiles: FileHit[] = hasQuery
    ? [
        {
          kind: "file",
          id: 9001,
          request_id: 101,
          name: "policy-update.pdf",
          mime: "application/pdf",
          size_bytes: 284312,
          created_at: new Date().toISOString(),
        },
      ]
    : [];

  // Real implementation (when you’re ready):
  // - Use @supabase/ssr createServerClient with cookies() for user-scoped FTS
  // - SELECT columns matching RequestHit / FileHit
  // - RLS enforces per-user visibility
  // - Combine into { requests, files }

  return json({ requests: demoRequests, files: demoFiles });
}
