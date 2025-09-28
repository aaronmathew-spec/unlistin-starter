import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { site_url, category, notes } = body;

  // Adjust table/columns to your schema
  const { data, error } = await supabase
    .from("requests")
    .insert({
      site_url,
      category,
      notes,
      user_id: user.id
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ request: data }, { status: 201 });
}
