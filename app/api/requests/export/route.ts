// app/api/requests/export/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

/**
 * GET /api/requests/export
 * Optional query params:
 *   - status: 'open' | 'in_progress' | 'resolved' | 'closed'
 *   - q: text search (title/description)
 */
export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  // Build query with RLS enforcing per-user access
  let query = supabase
    .from("requests")
    .select("id,title,description,status,created_at,updated_at")
    .order("id", { ascending: true });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Client-side filter for q to keep PG query simple/cost-effective
  const rows =
    (data || []).filter((r) => {
      if (!q) return true;
      const hay =
        (r.title || "").toLowerCase() +
        " " +
        (r.description || "").toLowerCase();
      return hay.includes(q);
    }) ?? [];

  const csv = toCsv(rows, [
    ["ID", (r) => r.id],
    ["Title", (r) => r.title ?? ""],
    ["Description", (r) => r.description ?? ""],
    ["Status", (r) => r.status],
    ["Created At", (r) => r.created_at ?? ""],
    ["Updated At", (r) => r.updated_at ?? ""],
  ]);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="requests-export.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
