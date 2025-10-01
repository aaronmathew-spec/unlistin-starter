export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Vercel Cron-safe endpoint for scheduled rescans.
 * Protect with env CRON_SECRET, pass as header "x-cron-secret".
 * Action: for all open/in_progress requests, enqueue a "rescan_queued" event.
 * If tables are missing, this returns ok:true with a note.
 */
function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const hdr = req.headers.get("x-cron-secret") || "";
  if (!secret || hdr !== secret) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const db = supa();

  // Check if "requests" exists
  const probe = await db.from("requests").select("id,status").limit(1);
  if (probe.error && /relation .* does not exist/i.test(probe.error.message)) {
    return NextResponse.json({ ok: true, note: "No requests table; skipping." });
  }

  // Fetch candidate requests
  const { data: rows, error } = await db
    .from("requests")
    .select("id")
    .in("status", ["open", "in_progress"])
    .limit(500);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const ids = (rows || []).map((r: any) => r.id).filter((n: any) => Number.isFinite(n));
  if (ids.length === 0) return NextResponse.json({ ok: true, queued: 0 });

  // Best-effort event inserts; ignore if table missing
  try {
    const payload = ids.map((id) => ({
      request_id: id,
      type: "rescan_queued",
      details_json: { reason: "scheduled", by: "cron" } as any,
    }));
    await db.from("request_events").insert(payload as any);
  } catch {
    // swallow; table could be absent in some environments
  }

  return NextResponse.json({ ok: true, queued: ids.length });
}
