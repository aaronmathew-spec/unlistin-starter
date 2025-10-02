// lib/ops/heartbeat.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/** Record a simple "last run" heartbeat for a job_id (no PII). */
export async function beat(job_id: "followups.run" | "actions.submit" | "detect.changes") {
  const db = supa();
  await db
    .from("job_heartbeats")
    .upsert({ job_id, last_run_at: new Date().toISOString() }, { onConflict: "job_id" });
}
