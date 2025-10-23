// src/lib/guards/circuit-breaker.ts
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR  = process.env.SUPABASE_SERVICE_ROLE!;

export type BreakerDecision = {
  allow: boolean;
  reason?: "ok" | "open" | "half_open";
  recentFailures?: number;
};

export async function shouldAllowController(
  controllerKey: string,
  windowMinutes = 15,
  threshold = 8
): Promise<BreakerDecision> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const sb = createClient(URL, SR, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("controller_failures")
    .select("id", { count: "exact", head: true })
    .eq("controller_key", controllerKey)
    .gte("created_at", since);

  const recent = data ? (data as unknown as any[]).length : 0; // head:true count is sometimes driver-specific
  const allow = error ? true : recent < threshold;
  return { allow, reason: allow ? "ok" : "open", recentFailures: recent };
}

export async function recordControllerFailure(controllerKey: string, errorCode?: string, note?: string) {
  const sb = createClient(URL, SR, { auth: { persistSession: false } });
  await sb.from("controller_failures").insert({ controller_key: controllerKey, error_code: errorCode, note });
}
