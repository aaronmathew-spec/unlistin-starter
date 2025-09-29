import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET   /api/requests/[id]
 * PATCH /api/requests/[id]  -> body: { status?: 'open'|'in_progress'|'resolved'|'closed', title?: string, description?: string }
 *
 * RLS: requests table must be owner-scoped. Query filters by id and RLS ensures only owner can read/update.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);

  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return NextResponse.json({ request: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Allow only specific fields
  const payload: Record<string, any> = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (t.length === 0 || t.length > 200) {
      return NextResponse.json({ error: "Title must be 1–200 chars" }, { status: 400 });
    }
    payload.title = t;
  }
  if (typeof body.description === "string") {
    const d = body.description.trim();
    if (d.length > 5000) {
      return NextResponse.json({ error: "Description too long" }, { status: 400 });
    }
    payload.description = d;
  }
  if (typeof body.status === "string") {
    const allowed = ["open", "in_progress", "resolved", "closed"];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    payload.status = body.status;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("requests")
    .update(payload)
    .eq("id", requestId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ request: data });
}
