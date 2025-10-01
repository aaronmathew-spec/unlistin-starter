// app/api/ai/index/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { ensureAiLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Body options:
 * - { reindexAll: true }           -> reindexes all requests + files for active users
 * - { kind: "request", id: number }  -> reindexes a single request
 * - { kind: "file", id: number }     -> reindexes a single file
 */
type IndexBody =
  | { reindexAll?: boolean }
  | { kind?: "request" | "file"; id?: number; reindexAll?: boolean };

const EMB_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

export async function POST(req: NextRequest) {
  // Rate limit (keep light; indexing is heavier)
  const { ok } = await ensureAiLimit(req);
  if (!ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again shortly." },
      { status: 429 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as IndexBody;
    const supa = getAdminClient();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // Helpers
    const embedText = async (chunks: { text: string }[]) => {
      if (chunks.length === 0) return [];
      const inputs = chunks.map((c) => c.text);
      const emb = await openai.embeddings.create({
        model: EMB_MODEL,
        input: inputs,
      });
      return emb.data.map((d) => d.embedding);
    };

    const insertRows = async (
      rows: {
        request_id: number;
        file_id: number | null;
        chunk_index: number;
        content: string;
        embedding: number[];
      }[]
    ) => {
      if (rows.length === 0) return;
      const { error } = await supa.from("ai_chunks").insert(rows as any);
      if (error) throw new Error(`insert ai_chunks failed: ${error.message}`);
    };

    // A) Single target
    if ((body as any).kind && typeof (body as any).id === "number") {
      const { kind, id } = body as { kind: "request" | "file"; id: number };

      if (kind === "request") {
        // Load request
        const { data: reqs, error } = await supa
          .from("requests")
          .select("id,title,description")
          .eq("id", id)
          .limit(1);
        if (error) throw new Error(error.message);
        const r = reqs?.[0];
        if (!r) return NextResponse.json({ ok: true, rows: 0 });

        // Remove previous chunks for this request
        await supa.from("ai_chunks").delete().eq("request_id", id);

        // Create a single chunk from title + description (simple starter)
        const content =
          [r.title, r.description].filter(Boolean).join("\n\n") || `Request #${id}`;
        const [vec] = await embedText([{ text: content }]);

        await insertRows([
          {
            request_id: id,
            file_id: null,
            chunk_index: 0,
            content,
            embedding: vec as unknown as number[],
          },
        ]);

        return NextResponse.json({ ok: true, rows: 1 });
      }

      // kind === "file"
      const { data: files, error } = await supa
        .from("request_files")
        .select("id,request_id,name")
        .eq("id", id)
        .limit(1);
      if (error) throw new Error(error.message);
      const f = files?.[0];
      if (!f) return NextResponse.json({ ok: true, rows: 0 });

      await supa.from("ai_chunks").delete().eq("file_id", id);

      // For now, index file name (later: extract real text content)
      const content = f.name || `File #${id}`;
      const [vec] = await embedText([{ text: content }]);

      await insertRows([
        {
          request_id: f.request_id,
          file_id: id,
          chunk_index: 0,
          content,
          embedding: vec as unknown as number[],
        },
      ]);

      return NextResponse.json({ ok: true, rows: 1 });
    }

    // B) Reindex ALL (simple pass: requests + files)
    if (body.reindexAll) {
      // Grab in batches to avoid timeouts if you have many rows
      const batchSize = 100;

      // 1) Requests
      {
        let from = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data: reqs, error } = await supa
            .from("requests")
            .select("id,title,description")
            .range(from, from + batchSize - 1);
          if (error) throw new Error(error.message);
          if (!reqs || reqs.length === 0) break;

          // Delete old chunks for this batch of ids
          const ids = reqs.map((r) => r.id);
          await supa.from("ai_chunks").delete().in("request_id", ids);

          const chunks = reqs.map((r, i) => ({
            request_id: r.id,
            file_id: null as number | null,
            chunk_index: 0,
            content:
              [r.title, r.description].filter(Boolean).join("\n\n") ||
              `Request #${r.id}`,
          }));

          const vectors = await embedText(chunks.map((c) => ({ text: c.content })));
          const rows = chunks.map((c, i) => ({
            ...c,
            embedding: vectors[i] as unknown as number[],
          }));

          await insertRows(rows);
          from += batchSize;
        }
      }

      // 2) Files
      {
        let from = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data: files, error } = await supa
            .from("request_files")
            .select("id,request_id,name")
            .range(from, from + batchSize - 1);
          if (error) throw new Error(error.message);
          if (!files || files.length === 0) break;

          const ids = files.map((f) => f.id);
          await supa.from("ai_chunks").delete().in("file_id", ids);

          const chunks = files.map((f) => ({
            request_id: f.request_id,
            file_id: f.id,
            chunk_index: 0,
            content: f.name || `File #${f.id}`,
          }));

          const vectors = await embedText(chunks.map((c) => ({ text: c.content })));
          const rows = chunks.map((c, i) => ({
            ...c,
            embedding: vectors[i] as unknown as number[],
          }));

          await insertRows(rows);
          from += batchSize;
        }
      }

      return NextResponse.json({ ok: true, reindexed: true });
    }

    return NextResponse.json({ ok: true, noop: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
