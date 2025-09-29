// app/api/search/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchItem =
  | {
      kind: "request";
      id: number;
      title: string | null;
      description: string | null;
      status: "open" | "in_progress" | "resolved" | "closed";
      updated_at: string | null;
    }
  | {
      kind: "coverage";
      id: number;
      broker_id: number;
      surface: string;
      note: string | null;
      status: "open" | "in_progress" | "resolved";
      updated_at: string | null;
    };

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") || 20)));
  const cursor = Number(searchParams.get("cursor") || 0) || 0; // simple numeric cursor (offset)
  const kinds = (searchParams.getAll("kind") || []) as Array<"requests" | "coverage">;

  if (!q) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  // Build ilike query fragments
  const like = `%${q}%`;

  const wantRequests = kinds.length === 0 || kinds.includes("requests");
  const wantCoverage = kinds.length === 0 || kinds.includes("coverage");

  const items: SearchItem[] = [];

  if (wantRequests) {
    const { data: reqs, error } = await supabase
      .from("requests")
      .select("id,title,description,status,updated_at")
      .or(`title.ilike.${like},description.ilike.${like}`) // simple OR matching
      .order("updated_at", { ascending: false, nullsFirst: false })
      .range(cursor, cursor + limit - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    (reqs || []).forEach((r) =>
      items.push({
        kind: "request",
        id: r.id,
        title: r.title ?? null,
        description: r.description ?? null,
        status: r.status as any,
        updated_at: r.updated_at ?? null,
      })
    );
  }

  if (wantCoverage) {
    const { data: covs, error } = await supabase
      .from("coverage")
      .select("id,broker_id,surface,note,status,updated_at")
      .or(`surface.ilike.${like},note.ilike.${like}`)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .range(cursor, cursor + limit - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    (covs || []).forEach((c) =>
      items.push({
        kind: "coverage",
        id: c.id,
        broker_id: c.broker_id,
        surface: c.surface,
        note: c.note ?? null,
        status: c.status as any,
        updated_at: c.updated_at ?? null,
      })
    );
  }

  // Merge + sort by recency
  items.sort((a, b) => {
    const da = a.updated_at ? Date.parse(a.updated_at) : 0;
    const db = b.updated_at ? Date.parse(b.updated_at) : 0;
    return db - da;
  });

  const nextCursor = items.length < limit ? null : String(cursor + limit);
  return NextResponse.json({ items, nextCursor });
}
