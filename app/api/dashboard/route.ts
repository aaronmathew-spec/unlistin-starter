// app/api/dashboard/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CountResp = { count: number | null; error?: { message: string } | null };

export async function GET(_req: NextRequest) {
  const supabase = createSupabaseServerClient();

  // Helper to do a count-select
  const count = async (table: string, filter?: (q: any) => any): Promise<number> => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count, error } = (await q) as CountResp;
    if (error) throw new Error(error.message);
    return count ?? 0;
  };

  try {
    const [
      reqTotal,
      reqOpen,
      reqInProgress,
      reqResolved,
      reqClosed,
      covTotal,
      covOpen,
      covInProgress,
      covResolved,
      brokersTotal,
      activityTop,
    ] = await Promise.all([
      count("requests"),
      count("requests", (q) => q.eq("status", "open")),
      count("requests", (q) => q.eq("status", "in_progress")),
      count("requests", (q) => q.eq("status", "resolved")),
      count("requests", (q) => q.eq("status", "closed")),
      count("coverage"),
      count("coverage", (q) => q.eq("status", "open")),
      count("coverage", (q) => q.eq("status", "in_progress")),
      count("coverage", (q) => q.eq("status", "resolved")),
      count("brokers"),
      supabase
        .from("activity")
        .select("id, entity_type, entity_id, action, meta, created_at")
        .order("id", { ascending: false })
        .limit(10),
    ]);

    if (activityTop.error) throw new Error(activityTop.error.message);

    return NextResponse.json({
      requests: {
        total: reqTotal,
        open: reqOpen,
        in_progress: reqInProgress,
        resolved: reqResolved,
        closed: reqClosed,
      },
      coverage: {
        total: covTotal,
        open: covOpen,
        in_progress: covInProgress,
        resolved: covResolved,
      },
      brokers: {
        total: brokersTotal,
      },
      activity: activityTop.data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Dashboard failed" }, { status: 400 });
  }
}
