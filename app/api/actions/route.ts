// app/api/actions/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { isAllowed } from "@/lib/scan/domains-allowlist";
import {
  type ActionRecord,
  type CreateActionInput,
  type UpdateActionInput,
  safeNowIso,
} from "@/lib/actions";
import { sha256Hex, signEnvelope } from "@/lib/ledger";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

/**
 * GET /api/actions
 * Returns current user's actions (RLS filters to user/session).
 */
export async function GET() {
  const db = supa();
  const { data, error } = await db
    .from("actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, actions: data as ActionRecord[] });
}

/**
 * POST /api/actions
 * Body: CreateActionInput (redacted-only fields)
 * - Enforces allowlist for evidence URLs
 * - Computes proof hash & HMAC signature (PII-safe)
 * - RLS ensures the row belongs to the caller
 */
export async function POST(req: Request) {
  const rl = await ensureSearchLimit(req);
  if (!rl?.ok) return json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });

  let body: CreateActionInput | null = null;
  try {
    body = (await req.json()) as CreateActionInput;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.broker || !body?.redacted_identity) {
    return json({ ok: false, error: "Missing broker or identity" }, { status: 400 });
  }

  const ev = (body.evidence || []).filter((e) => e && isAllowed(e.url)).slice(0, 20);
  const now = safeNowIso();

  // subject hash to avoid storing raw subject in the proof payload
  const subj = body.draft?.subject || "";
  const subjectHash = subj ? sha256Hex(subj) : undefined;

  const envelope = {
    id: "pending",
    broker: body.broker,
    category: body.category || "directory",
    redacted_identity: {
      namePreview: body.redacted_identity.namePreview,
      emailPreview: body.redacted_identity.emailPreview,
      cityPreview: body.redacted_identity.cityPreview,
    },
    evidence_urls: ev.map((e) => e.url),
    draft_subject_hash: subjectHash,
    timestamp: now,
  };
  const proof = signEnvelope(envelope);

  const row = {
    broker: body.broker,
    category: body.category || "directory",
    status: "draft",
    redacted_identity: body.redacted_identity,
    evidence: ev,
    draft_subject: body.draft?.subject?.slice(0, 140) || null,
    draft_body: body.draft?.body?.slice(0, 1800) || null,
    fields: body.draft?.fields || {},
    reply_channel: body.reply?.channel || "email",
    reply_email_preview: body.reply?.emailPreview || null,
    proof_hash: proof.hash,
    proof_sig: proof.sig,
  };

  const db = supa();
  const { data, error } = await db.from("actions").insert(row).select("*").maybeSingle();
  if (error) return json({ ok: false, error: error.message }, { status: 400 });

  // Return created row
  return NextResponse.json({ ok: true, action: data as ActionRecord });
}

/**
 * PATCH /api/actions
 * Body: { id: string, update: UpdateActionInput }
 * - Append evidence (allowlist enforced)
 * - Update non-PII fields
 */
export async function PATCH(req: Request) {
  const rl = await ensureSearchLimit(req);
  if (!rl?.ok) return json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });

  let body: { id: string; update: UpdateActionInput } | null = null;
  try {
    body = (await req.json()) as any;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.id || !body?.update) {
    return json({ ok: false, error: "Missing id or update" }, { status: 400 });
  }

  const db = supa();

  // Fetch existing
  const { data: existing, error: getErr } = await db
    .from("actions")
    .select("*")
    .eq("id", body.id)
    .maybeSingle();
  if (getErr) return json({ ok: false, error: getErr.message }, { status: 400 });
  if (!existing) return json({ ok: false, error: "Not found" }, { status: 404 });

  const upd: Record<string, any> = {
    updated_at: safeNowIso(),
  };

  if (body.update.status) upd.status = body.update.status;
  if (typeof body.update.draft_subject === "string")
    upd.draft_subject = body.update.draft_subject.slice(0, 140);
  if (typeof body.update.draft_body === "string")
    upd.draft_body = body.update.draft_body.slice(0, 1800);
  if (body.update.fields) upd.fields = body.update.fields;
  if (body.update.reply_channel) upd.reply_channel = body.update.reply_channel;
  if (typeof body.update.reply_email_preview === "string")
    upd.reply_email_preview = body.update.reply_email_preview;

  if (Array.isArray(body.update.evidenceAppend) && body.update.evidenceAppend.length) {
    const prior = Array.isArray(existing.evidence) ? existing.evidence : [];
    const append = body.update.evidenceAppend.filter((e) => e && isAllowed(e.url)).slice(0, 20);
    upd.evidence = [...prior, ...append];
  }

  const { data: updated, error } = await db
    .from("actions")
    .update(upd)
    .eq("id", body.id)
    .select("*")
    .maybeSingle();

  if (error) return json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, action: updated as ActionRecord });
}
