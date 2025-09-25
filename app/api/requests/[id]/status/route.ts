import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseServer";

const ALLOWED = new Set(["new", "queued", "in_progress", "done"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const next = String(body?.next ?? "");
  if (!ALLOWED.has(next)) return NextResponse.json({ error: `invalid status: ${next}` }, { status: 400 });

  const { error } = await supabase
    .from("requests")
    .update({ status: next })
    .eq("id", params.id)
    .eq("owner", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
