export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/**
 * GET /api/requests/[id]
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const db = supa();
    const { data, error } = await db
      .from("requests")
      .select("id, title, description, status, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ request: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}

/**
 * PATCH /api/requests/[id]
 * Body: { title?: string, description?: string, status?: "open" | "in_progress" | "closed" }
 * RLS is expected to enforce ownership.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { title, description, status } = body as {
      title?: unknown;
      description?: unknown;
      status?: unknown;
    };

    const patch: Record<string, unknown> = {};

    if (typeof title === "string") {
      const t = title.trim();
      if (!t) {
        return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
      }
      if (t.length > 200) {
        return NextResponse.json({ error: "Title too long (<=200)" }, { status: 400 });
      }
      patch.title = t;
    }

    if (typeof description === "string") {
      const d = description.trim();
      if (d.length > 5000) {
        return NextResponse.json({ error: "Description too long (<=5000)" }, { status: 400 });
      }
      patch.description = d;
    }

    if (typeof status === "string") {
      const allowed = new Set(["open", "in_progress", "closed"]);
      if (!allowed.has(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      patch.status = status;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const db = supa();

    const { data, error } = await db
      .from("requests")
      .update(patch)
      .eq("id", id)
      .select("id, title, description, status, created_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Optional best-effort event log
    try {
      await db.from("request_events").insert({
        request_id: id,
        type: "updated",
        message: JSON.stringify(patch).slice(0, 1000),
      } as any);
    } catch {
      // ignore
    }

    return NextResponse.json({ request: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
