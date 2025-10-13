// src/agents/policy/synth.ts
import { createClient } from "@supabase/supabase-js";

export type PolicyInput = {
  subjectId: string; // uuid
};

export type ControllerPolicy = {
  controller_id: string | null;
  controller_name: string;
  channel: "email" | "form" | "api";
  channels: Record<string, any> | null; // raw controller channels jsonb
  identity: "none" | "email_verify" | "phone_verify" | "aadhaar" | "digilocker" | string;
  sla_days: number;
  escalation_path: string[]; // grievance_officer, dpo, dpb, etc
  url?: string | null; // when we know a target URL from discovered_items
  data_type?: string | null; // phone|email|listing...
};

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
 * Synthesize minimal policy per discovered controller for this subject.
 * For MVP we keep it deterministic (no LLM) but shaped to add LLM later.
 */
export async function synthesizePolicies(input: PolicyInput): Promise<ControllerPolicy[]> {
  const supabase = db();

  // Join discovered_items with controllers to know the controller + channel hints
  const { data: items, error } = await supabase
    .from("discovered_items")
    .select(
      `
      id,
      controller_id,
      url,
      data_type,
      controllers:controller_id (
        id,
        name,
        channels,
        identity_requirements,
        sla_days,
        escalation_path
      )
    `
    )
    .eq("subject_id", input.subjectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`[policy] cannot read discovered_items: ${error.message}`);
  if (!items || items.length === 0) return [];

  // Build a minimal per-controller policy
  const out: ControllerPolicy[] = [];
  for (const it of items) {
    const ctrl = (it as any).controllers;
    const controllerName = ctrl?.name ?? "Unknown";
    const channels = ctrl?.channels ?? null;
    const identity = (ctrl?.identity_requirements ?? "none") as ControllerPolicy["identity"];
    const sla_days = Number(ctrl?.sla_days ?? 30);
    const escalation_path = Array.isArray(ctrl?.escalation_path) ? ctrl.escalation_path : [];

    // Decide channel priority: email > formUrl > apiEndpoint (can be tuned/controller-specific)
    let channel: ControllerPolicy["channel"] = "email";
    if (channels?.formUrl && !channels?.email) channel = "form";
    if (channels?.apiEndpoint && !(channels?.email || channels?.formUrl)) channel = "api";

    out.push({
      controller_id: ctrl?.id ?? it.controller_id ?? null,
      controller_name: controllerName,
      channel,
      channels,
      identity,
      sla_days,
      escalation_path,
      url: it.url ?? null,
      data_type: it.data_type ?? null,
    });
  }

  // Deduplicate by controller (prefer first seen for MVP)
  const seen = new Set<string>();
  const deduped: ControllerPolicy[] = [];
  for (const p of out) {
    const k = p.controller_name;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(p);
  }

  return deduped;
}
