// src/lib/guards/circuit-breaker.ts
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR  = process.env.SUPABASE_SERVICE_ROLE!;

export type BreakerDecision = {
  allow: boolean;
  reason?: "ok" | "open";
  recentFailures?: number;
};

/**
 * If recent failures >= threshold within windowMinutes -> block
 */
export async function shouldAllowController(
  controllerKey: string,
  windowMinutes = 15,
  threshold = 8
): Promise<BreakerDecision> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const sb = createClient(URL, SR, { auth: { persistSession: false } });

  // count() can vary per driver; head:true gives headers count in some modes.
  const { data, error, count } = await sb
    .from("controller_failures")
    .select("id", { count: "exact" })
    .eq("controller_key", controllerKey)
    .gte("created_at", since);

  const recent = typeof count === "number" ? count : (data?.length ?? 0);
  const allow = error ? true : recent < threshold;
  return { allow, reason: allow ? "ok" : "open", recentFailures: recent };
}

export async function recordControllerFailure(controllerKey: string, errorCode?: string, note?: string) {
  const sb = createClient(URL, SR, { auth: { persistSession: false } });
  await sb.from("controller_failures").insert({
    controller_key: controllerKey,
    error_code: errorCode ?? null,
    note: note ?? null,
  });
}
