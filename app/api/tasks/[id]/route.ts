import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabaseSSR() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const supabase = getSupabaseSSR();

  const [taskRes, eventsRes] = await Promise.all([
    supabase.from("background_tasks").select("*").eq("id", id).single(),
    supabase
      .from("background_task_events")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (taskRes.error) {
    return NextResponse.json({ error: taskRes.error.message }, { status: 400 });
  }

  return NextResponse.json({
    task: taskRes.data,
    events: eventsRes.data ?? [],
  });
}
