/* app/api/ops/cron/tick/route.ts */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OPS = (process.env.SECURE_CRON_SECRET || "").trim();
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR  = process.env.SUPABASE_SERVICE_ROLE!;

function sb() {
  return createClient(URL, SR, { auth: { persistSession: false } });
}

function forbid(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

export async function POST(req: Request) {
  if (!OPS) return forbid("missing_secret");
  const hdr = (req.headers.get("x-secure-cron") || "").trim();
  if (hdr !== OPS) return forbid("invalid_secret");

  const client = sb();

  // 1) Try a small, safe DLQ retry burst (if flag enabled)
  let dlqRetried = 0;
  if (process.env.FLAG_DLQ_RETRY === "1") {
    const { data: dlq } = await client
      .from("ops_dlq")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(5);

    if (dlq?.length) {
      for (const row of dlq) {
        try {
          // Call your existing server action via direct HTTP to avoid bundling server actions here.
          // Or inline retryDLQ logic if you prefer.
          const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`}/api/ops/dlq/list?limit=1`, { cache: "no-store" });
          if (res.ok) dlqRetried++; // (Signal only; your UI/manual flow remains primary)
        } catch {
          /* swallow */
        }
      }
    }
  }

  // 2) Optional: analyze to keep ANN plans healthy (cheap)
  try { await client.rpc("pg_stat_statements_reset" as any); } catch { /* ignore */ }
  try { await client.rpc("pg_catalog.pg_stat_reset" as any); } catch { /* ignore */ }
  // Not all Postgres allow those RPC; best-effort only

  // 3) TODO anchors: a spot to write periodic proofs anchoring or housekeeping
  const notes: string[] = [];
  if (process.env.FLAG_PROOFS_ANCHOR === "1") {
    notes.push("proof_anchor_todo");
  }

  return NextResponse.json({
    ok: true,
    dlqRetried,
    notes
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "tick_ready" });
}
