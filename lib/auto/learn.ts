// lib/auto/learn.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Minimal learning hook for auditing outcomes of the pipeline.
 * This is intentionally lightweight & idempotent-ish (by (action_id,resolution) pair).
 *
 * Table suggested:
 *   outcomes(
 *     id bigint pk,
 *     action_id bigint not null,
 *     broker text,
 *     adapter text,
 *     state text,
 *     resolution text,            -- e.g. 'sent','skipped','prepared','error'
 *     took_ms integer null,
 *     created_at timestamptz default now()
 *   )
 * Unique index recommended over (action_id, resolution) for dedupe.
 */

export type Outcome = {
  action_id: number;
  broker?: string | null;
  adapter?: string | null;
  state?: string | null;
  resolution: string;
  took_ms?: number | null;
  note?: string | null;
};

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/** Best-effort write. Never throws. */
export async function recordOutcome(out: Outcome): Promise<{ ok: boolean; id?: number }> {
  try {
    const db = supa();

    // Try a naive insert first
    const { data, error } = await db
      .from("outcomes")
      .insert({
        action_id: out.action_id,
        broker: out.broker ?? null,
        adapter: out.adapter ?? null,
        state: out.state ?? null,
        resolution: `${out.resolution}`.slice(0, 40),
        took_ms: Number.isFinite(out.took_ms as any) ? Number(out.took_ms) : null,
        note: out.note ?? null,
      })
      .select("id")
      .maybeSingle();

    if (!error && data?.id) return { ok: true, id: data.id };

    // Idempotency fallback: return the existing row id if unique constraint triggers
    const { data: existing } = await db
      .from("outcomes")
      .select("id")
      .eq("action_id", out.action_id)
      .eq("resolution", out.resolution)
      .maybeSingle();

    if (existing?.id) return { ok: true, id: existing.id };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
