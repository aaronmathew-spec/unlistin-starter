// app/api/cron/ai-index/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { chunkText } from "@/lib/chunk";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // supabase-js uses Node APIs

// ---- Settings ---------------------------------------------------------------
const MODEL = "text-embedding-3-small";
const MAX_PER_RUN = 50; // safety cap to keep the job light
// ----------------------------------------------------------------------------

type Body =
  | { reindexAll?: boolean }
  | { kind: "request" | "file"; id: number }
  | undefined;

function getAdminAuth(req: Request) {
  const token = process.env.ADMIN_API_TOKEN;
  const hdr = req.headers.get("authorization") || "";
  const bearer = hdr.startsWith("Bearer ") ? hdr.slice(7) : undefined;
  const isCron = !!req.headers.get("x-vercel-cron");
  const okBearer = token && bearer === token;
  return { isCron, okBearer };
}

function assertFeatureEnabled() {
  if (process.env.FEATURE_AI_SERVER !== "1") {
    throw new Error("FEATURE_AI_SERVER is disabled");
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("SUPABASE_URL missing");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI embeddings error: ${res.status} ${t}`);
  }
  const j = await res.json();
  return (j.data as Array<{ embedding: number[] }>).map((d) => d.embedding);
}

async function selectWork(db: any, scope?: { kind: "request" | "file"; id: number }, reindexAll?: boolean) {
  // You may tailor these selectors to your schema. This version assumes:
  // - public.request_files: id, request_id, text_content, ai_indexed_at, updated_at
  // - Only files with text_content get indexed
  const base = db
    .from("request_files")
    .select("id, request_id, text_content, ai_indexed_at, updated_at")
    .is("deleted_at", null)
    .not("text_content", "is", null)
    .limit(MAX_PER_RUN);

  if (scope?.kind === "file") return base.eq("id", scope.id);
  if (scope?.kind === "request") return base.eq("request_id", scope.id);
  if (reindexAll) return base.order("updated_at", { ascending: false });

  // default incremental: updated since last index or never indexed
  return base.or("ai_indexed_at.is.null,updated_at.gt.ai_indexed_at").order("updated_at", { ascending: false });
}

async function upsertChunks(db: any, fileId: number, requestId: number, chunks: string[], vectors: number[][]) {
  const rows = chunks.map((c, i) => ({
    request_id: requestId,
    file_id: fileId,
    chunk_index: i,
    content: c,
    // For pgvector column named "embedding"
    embedding: vectors[i] as unknown as any,
  }));

  // Clear old chunks then insert fresh to keep it simple and deterministic
  await db.from("ai_chunks").delete().eq("file_id", fileId);
  const { error } = await db.from("ai_chunks").insert(rows);
  if (error) throw new Error(error.message);

  await db.from("request_files").update({ ai_indexed_at: new Date().toISOString() }).eq("id", fileId);
}

export async function POST(req: Request) {
  try {
    assertFeatureEnabled();

    const { isCron, okBearer } = getAdminAuth(req);
    if (!isCron && !okBearer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => undefined)) as Body;
    const scope = (body && "kind" in body && "id" in body
      ? ({ kind: body.kind, id: body.id } as const)
      : undefined);
    const reindexAll = !!(body && "reindexAll" in body && body.reindexAll);

    const db = supabaseAdmin();

    // 1) Find work
    const { data: files, error: selErr } = await selectWork(db, scope, reindexAll);
    if (selErr) throw new Error(selErr.message);
    const batch = (files || []).slice(0, MAX_PER_RUN);

    // 2) Build chunks
    const allChunks: Array<{ fileId: number; requestId: number; chunks: string[] }> = [];
    for (const f of batch) {
      const chunks = chunkText(f.text_content as string);
      if (chunks.length) allChunks.push({ fileId: f.id as number, requestId: f.request_id as number, chunks });
    }

    // 3) Embed in groups to stay under token/size limits
    let processed = 0;
    for (const item of allChunks) {
      const vectors = await embedMany(item.chunks);
      await upsertChunks(db, item.fileId, item.requestId, item.chunks, vectors);
      processed += 1;
    }

    return NextResponse.json({
      ok: true,
      scanned: batch.length,
      indexed: processed,
      scope: scope ?? (reindexAll ? "reindexAll" : "incremental"),
    });
  } catch (e: any) {
    console.error("[cron ai-index] error:", e);
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}

// Optional GET for quick checks (manual via curl is fine)
export async function GET(req: Request) {
  return POST(req);
}
