// app/api/requests/[id]/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Status = "open" | "in_progress" | "resolved" | "closed";

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as {
    title?: unknown;
    description?: unknown;
    status?: unknown;
    note?: unknown;
  };

  const { data: current, error: curErr } = await supabase
    .from("requests")
    .select("id, title, description, status")
    .eq("id", requestId)
    .single();

  if (curErr || !current) {
    return NextResponse.json({ error: curErr?.message || "Not found" }, { status: 404 });
  }

  const payload: Record<string, unknown> = {};
  if (typeof b.title === "string") {
    const t = b.title.trim();
    if (t.length === 0 || t.length > 200) {
      return NextResponse.json({ error: "Title must be 1–200 chars" }, { status: 400 });
    }
    payload.title = t;
  }
  if (typeof b.description === "string") {
    const d = b.description.trim();
    if (d.length > 5000) {
      return NextResponse.json({ error: "Description too long" }, { status: 400 });
    }
    payload.description = d;
  }
  if (typeof b.status === "string") {
    const allowed = new Set<Status>(["open", "in_progress", "resolved", "closed"]);
    if (!allowed.has(b.status as Status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    payload.status = b.status;
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const newStatus = updated.status as Status | undefined;
  const oldStatus = current.status as Status | undefined;
  if (newStatus && oldStatus && newStatus !== oldStatus) {
    const note =
      typeof b.note === "string" && b.note.trim().length > 0
        ? b.note.trim().slice(0, 2000)
        : undefined;

    const message = note
      ? `Status changed: ${labelForStatus(oldStatus)} → ${labelForStatus(newStatus)} — ${note}`
      : `Status changed: ${labelForStatus(oldStatus)} → ${labelForStatus(newStatus)}`;

    await supabase.from("request_activity").insert({
      request_id: requestId,
      type: "status_changed",
      message,
      meta: { old_status: oldStatus, new_status: newStatus, note: note ?? null },
    });
  }

  return NextResponse.json({ request: updated });
}

/* ----------------------------- helpers ----------------------------- */
function labelForStatus(s: Status) {
  switch (s) {
    case "open":
      return "Open";
    case "in_progress":
      return "In Progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
  }
}
