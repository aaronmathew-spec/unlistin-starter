import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  const cron = !!process.env.SECURE_CRON_SECRET;

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!url,
    SUPABASE_SERVICE_ROLE: !!key,
    SECURE_CRON_SECRET: cron,
  };

  // try lightweight ping
  let supabaseOk = false;
  if (url && key) {
    try {
      const supa = createClient(url, key, { auth: { persistSession: false } });
      // cheap call
      const { data, error } = await supa.from("authorizations").select("id").limit(1);
      if (!error) supabaseOk = true;
    } catch {
      supabaseOk = false;
    }
  }

  const ok = Object.values(env).every(Boolean) && supabaseOk;

  return NextResponse.json(
    { ok, env, supabaseOk, ts: new Date().toISOString() },
    { status: ok ? 200 : 500 }
  );
}
