// lib/controllers/store.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import type { ControllerMeta, PreferredChannel } from "./meta";
import { getDefaultControllerMeta } from "./meta";

// service-role client (server only)
function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type ControllerRow = {
  key: string;
  preferred_channel: PreferredChannel;
  sla_target_min: number;
  form_url: string | null;
  updated_at: string;
};

function mergeOverride(base: ControllerMeta, row?: ControllerRow | null): ControllerMeta {
  if (!row) return base;
  return {
    ...base,
    preferred: (row.preferred_channel || base.preferred) as PreferredChannel,
    slaTargetMin: typeof row.sla_target_min === "number" ? row.sla_target_min : base.slaTargetMin,
    formUrl: row.form_url || base.formUrl,
  };
}

export async function loadControllerMeta(key: string): Promise<ControllerMeta | null> {
  const base = getDefaultControllerMeta(key);
  if (!base) return null;
  try {
    const supa = adminSupabase();
    const { data, error } = await supa
      .from("controllers_meta")
      .select("key, preferred_channel, sla_target_min, form_url, updated_at")
      .eq("key", base.key)
      .maybeSingle();
    if (error) {
      console.warn("[controllers_meta.load.error]", error.message);
      return base;
    }
    return mergeOverride(base, data as ControllerRow | null);
  } catch (e: any) {
    console.warn("[controllers_meta.load.exception]", e?.message || e);
    return base;
  }
}

export async function listControllerMetas(): Promise<ControllerMeta[]> {
  const keys = Object.keys(getDefaultIndex());
  const supa = adminSupabase();
  const { data, error } = await supa
    .from("controllers_meta")
    .select("key, preferred_channel, sla_target_min, form_url, updated_at");
  const rows = error ? [] : ((data ?? []) as ControllerRow[]);
  const rowMap = new Map(rows.map((r) => [r.key.toLowerCase(), r]));

  return keys.map((k) => {
    const base = getDefaultControllerMeta(k)!;
    return mergeOverride(base, rowMap.get(k) || null);
  });
}

function getDefaultIndex() {
  // lazy import to avoid circular
  const { CONTROLLER_DEFAULTS } = require("./meta") as typeof import("./meta");
  return CONTROLLER_DEFAULTS as Record<string, ControllerMeta>;
}

export async function upsertControllerMeta(input: {
  key: string;
  preferred: PreferredChannel;
  slaTargetMin: number;
  formUrl?: string;
}) {
  const supa = adminSupabase();
  const payload = {
    key: input.key.toLowerCase(),
    preferred_channel: input.preferred,
    sla_target_min: input.slaTargetMin,
    form_url: input.formUrl || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supa.from("controllers_meta").upsert(payload, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return payload.key;
}
