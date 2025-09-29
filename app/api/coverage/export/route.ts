// app/api/coverage/export/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

/**
 * GET /api/coverage/export
 * Optional query params:
 *   - status: 'open' | 'in_progress' | 'resolved'
 *   - q: text search over surface/note
 */
export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  let query = supabase
    .from("coverage")
    .select("id,broker_id,surface,status,weight,note,created_at,updated_at")
    .order("id", { ascending: true });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows =
    (data || []).filter((r) => {
      if (!q) return true;
      const hay =
        (r.surface || "").toLowerCase() + " " + (r.note || "").toLowerCase();
      return hay.includes(q);
    }) ?? [];

  const csv = toCsv(rows, [
    ["ID", (r) => r.id],
    ["Broker ID", (r) => r.broker_id],
    ["Surface", (r) => r.surface],
    ["Status", (r) => r.status],
    ["Weight", (r) => r.weight ?? ""],
    ["Note", (r) => r.note ?? ""],
    ["Created At", (r) => r.created_at ?? ""],
    ["Updated At", (r) => r.updated_at ?? ""],
  ]);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="coverage-export.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
