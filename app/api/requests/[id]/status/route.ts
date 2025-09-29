import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const ALLOWED = new Set(["open", "in_review", "approved", "changes_requested", "done", "archived"]);

function getSSR() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

// PATCH /api/requests/:id/status  { status: "in_review" }
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const requestId = Number(params.id);
  if (!requestId) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const supabase = getSSR();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await req.json().catch(() => ({}));
  const status = String(payload?.status ?? "");
  if (!ALLOWED.has(status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  // Read current status
  const { data: current, error: curErr } = await supabase
    .from("requests")
    .select("status")
    .eq("id", requestId)
    .single();

  if (curErr || !current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (current.status === status) {
    return NextResponse.json({ updated: false, status });
  }

  const { error: updErr } = await supabase
    .from("requests")
    .update({ status })
    .eq("id", requestId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  await supabase.from("request_events").insert({
    request_id: requestId,
    event_type: "status_changed",
    meta: { from: current.status, to: status },
  });

  return NextResponse.json({ updated: true, status });
}
