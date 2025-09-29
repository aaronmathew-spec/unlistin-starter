// app/api/exposure/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/exposure
 * returns: { score: number }   // 0..100
 */
export async function GET(_req: NextRequest) {
  const supabase = createSupabaseServerClient();

  // Prefer the view; if no rows yet, compute fallback inline
  const { data: viewRows /*, error: viewErr */ } = await supabase
    .from("exposure_score")
    .select("score")
    .limit(1);

  const rows = (viewRows ?? []) as Array<{ score: number | null }>;
  const firstScore = rows.length > 0 ? rows[0]?.score : null;

  if (typeof firstScore === "number" && Number.isFinite(firstScore)) {
    return NextResponse.json({ score: clamp(firstScore, 0, 100) });
  }

  // Fallback: compute from user's coverage
  const { data: coverageRows /*, error: covErr */ } = await supabase
    .from("coverage")
    .select("status, weight");

  const items = (coverageRows ?? []) as Array<{ status: string | null; weight: number | null }>;
  const total = items.reduce((s, r) => s + (Number(r.weight ?? 0) || 0), 0);
  const exposed = items.reduce(
    (s, r) => s + (r.status === "resolved" ? 0 : (Number(r.weight ?? 0) || 0)),
    0
  );
  const score = total > 0 ? (exposed / total) * 100 : 0;

  return NextResponse.json({ score: clamp(score, 0, 100) });
}

/* --------------------- */
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
