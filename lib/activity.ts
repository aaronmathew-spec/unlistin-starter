// lib/activity.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActivityInput = {
  entity_type: "request" | "coverage" | "broker" | "file";
  entity_id: number;
  action: "create" | "update" | "status" | "delete" | "upload" | "download";
  meta?: Record<string, unknown> | null;
};

/**
 * Fire-and-forget activity logger. Intentionally swallows errors
 * so API responses aren't blocked if logging fails.
 */
export async function logActivity(ev: ActivityInput): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    await supabase.from("activity").insert({
      entity_type: ev.entity_type,
      entity_id: ev.entity_id,
      action: ev.action,
      meta: ev.meta ?? null,
    });
  } catch {
    // no-op
  }
}
