// lib/dispatch/log.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/crypto/hash";

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type DedupeWindow = { minutes?: number; hours?: number };

export function makeDedupeKey(input: {
  controllerKey: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  locale?: "en" | "hi";
}): string {
  const key = (input.controllerKey || "").toLowerCase();
  // normalize email/phone/name to reduce accidental misses
  const email = (input.email || "").trim().toLowerCase();
  const phone = (input.phone || "").replace(/[^\d+]/g, "");
  const name = (input.name || "").trim().replace(/\s+/g, " ").toLowerCase();
  const locale = input.locale || "en";
  return sha256Hex([key, email, phone, name, locale].join("|"));
}

export async function wasRecentlyDispatched(dedupeKey: string, window: DedupeWindow = { hours: 24 }) {
  const supa = adminSupabase();
  const mins = (window.minutes ?? 0) + (window.hours ?? 0) * 60;
  const since = new Date(Date.now() - mins * 60_000).toISOString();
  const { data, error } = await supa
    .from("dispatch_log")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .gte("created_at", since)
    .limit(1);
  if (error) {
    console.warn("[dispatch_log.recent.error]", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

export async function recordDispatch(result: {
  dedupeKey: string;
  controllerKey: string;
  subject: { name?: string | null; email?: string | null; phone?: string | null };
  locale: "en" | "hi";
  ok: boolean;
  channel?: string | null;
  providerId?: string | null;
  note?: string | null;
  error?: string | null;
}) {
  const supa = adminSupabase();
  const payload = {
    dedupe_key: result.dedupeKey,
    controller_key: result.controllerKey,
    subject_email: result.subject.email ?? null,
    subject_phone: result.subject.phone ?? null,
    subject_name: result.subject.name ?? null,
    locale: result.locale,
    channel: result.channel ?? null,
    provider_id: result.providerId ?? null,
    note: result.note ?? null,
    ok: !!result.ok,
    error: result.error ?? null,
  };
  const { error } = await supa.from("dispatch_log").insert(payload);
  if (error) console.warn("[dispatch_log.insert.error]", error.message);
}
