/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Minimal mail queue for Phase 1 Auto-Submit (email-only).
 * We DO NOT persist or log raw PII or full email bodies here.
 * We only persist hashes/metadata and tie to action_id for auditing.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { sha256Hex } from "@/lib/ledger";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export type OutboxQueueResult = { ok: boolean; outboxId?: string; error?: string };

export async function queueEmailFromAction(params: {
  actionId: number;
  broker: string;
  subjectPreview: string; // redacted/short
  hasBody: boolean;       // true if we had a body (not stored)
}) : Promise<OutboxQueueResult> {
  const db = supa();
  const subject_hash = sha256Hex((params.subjectPreview || "").slice(0, 160));
  const { data, error } = await db
    .from("outbox_emails")
    .insert({
      action_id: params.actionId,
      broker: params.broker,
      subject_hash,
      body_present: params.hasBody,
      status: "queued"
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, outboxId: data?.id };
}
