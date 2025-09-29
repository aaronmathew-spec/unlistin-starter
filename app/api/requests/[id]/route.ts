// app/api/requests/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET   /api/requests/[id]
 * PATCH /api/requests/[id]
 *   body: { status?: 'open'|'in_progress'|'resolved'|'closed', title?: string, description?: string, note?: string }
 * - On status change, inserts into request_activity
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

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
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

  // Fetch current row (for comparison)
  const { data: current, error: curErr } = await supabase
    .from("requests")
    .select("id, title, description, status")
    .eq("id", requestId)
    .single();

  if (curErr || !current) {
    return NextResponse.json({ error: curErr?.message || "Not found" }, { status: 404 });
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

  const { data: updated, error } = await supabase
    .from("requests")
    .update(payload)
    .eq("id", requestId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // If status changed, write activity record
  const newStatus = updated.status as string | undefined;
  const oldStatus = current.status as string | undefined;
  if (newStatus && oldStatus && newStatus !== oldStatus) {
    const note =
      typeof body.note === "string" && body.note.trim().length > 0
        ? body.note.trim().slice(0, 2000)
        : undefined;

    const message = note
      ? `Status changed: ${labelForStatus(oldStatus as any)} → ${labelForStatus(newStatus as any)} — ${note}`
      : `Status changed: ${labelForStatus(oldStatus as any)} → ${labelForStatus(newStatus as any)}`;

    await supabase
      .from("request_activity")
      .insert({
        request_id: requestId,
        type: "status_changed",
        message,
        meta: {
          old_status: oldStatus,
          new_status: newStatus,
          note: note ?? null,
        },
      });
    // Ignore insert errors to avoid failing the PATCH response
  }

  return NextResponse.json({ request: updated });
}

/* ----------------------------- helpers ----------------------------- */

function labelForStatus(s: "open" | "in_progress" | "resolved" | "closed" | string) {
  switch (s) {
    case "open": return "Open";
    case "in_progress": return "In Progress";
    case "resolved": return "Resolved";
    case "closed": return "Closed";
    default: return s;
  }
}
