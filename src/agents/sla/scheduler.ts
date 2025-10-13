// src/agents/sla/scheduler.ts
import { createClient } from "@supabase/supabase-js";
import { addDays } from "date-fns";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Flags actions as escalate_pending if they are older than controller.sla_days
 * and still not resolved.
 */
export async function checkSlaAndFlagOverdues() {
  const supabase = db();

  // Only actions that were successfully sent and haven't already escalated/verified/failed.
  const { data: sent, error } = await supabase
    .from("actions")
    .select(
      `
      id, subject_id, controller_id, status, created_at,
      controllers:controller_id ( id, name, sla_days )
    `
    )
    .in("status", ["sent"]) // keep tight; we won't re-flag escalated/verified/failed
    .order("created_at", { ascending: true });

  if (error) throw new Error(`[sla] cannot read actions: ${error.message}`);
  if (!sent || sent.length === 0) return { scanned: 0, flagged: 0 };

  let flagged = 0;
  for (const a of sent) {
    const slaDays = Number((a as any)?.controllers?.sla_days ?? 30);
    const dueAt = addDays(new Date(a.created_at), slaDays);

    if (new Date() > dueAt) {
      const { error: updErr } = await supabase
        .from("actions")
        .update({ status: "escalate_pending" })
        .eq("id", a.id);
      if (!updErr) flagged++;
    }
  }

  return { scanned: sent.length, flagged };
}
