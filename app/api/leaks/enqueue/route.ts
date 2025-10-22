// app/api/leaks/enqueue/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const SECURE_CRON_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  const hdr = (req.headers.get("x-secure-cron") || "").trim();
  if (!SECURE_CRON_SECRET || hdr !== SECURE_CRON_SECRET) {
    return bad(403, "unauthorized");
  }

  // Example sources (you can add your own allowlist in existing cron tool)
  const sources = [
    "https://pastebin.com/u/unlist",
    "https://gist.github.com/search?q=unlistin",
  ];

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  const rows = sources.map((url) => ({
    type: "http_get",
    status: "queued",
    payload: { url, headers: { "user-agent": "UnlistIN-Monitor/1.0" } },
  }));

  const { error } = await sb.from("background_tasks").insert(rows);
  if (error) return bad(400, error.message);

  return NextResponse.json({ ok: true, enqueued: rows.length });
}
