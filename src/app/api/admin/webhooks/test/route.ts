export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { emitWebhook } from "@/lib/webhooks";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const Input = z.object({
  event: z.string().default("run.updated"),
  sample: z.any().optional(),
});

export async function POST(req: NextRequest) {
  const supa = getServerSupabase();
  const { data: session } = await supa.auth.getUser();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Input.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });

  // use the latest run for the user as a sample payload fallback
  let payload = parsed.data.sample ?? null;
  if (!payload) {
    const { data: run } = await db
      .from("agent_runs")
      .select("id, subject_id, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    payload = run ?? { ping: "ok" };
  }

  await emitWebhook(session.user.id, parsed.data.event, payload);
  return NextResponse.json({ ok: true });
}
