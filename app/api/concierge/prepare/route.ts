// app/api/concierge/prepare/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";
import { ensureAiLimit } from "@/lib/ratelimit";
import { isAllowed } from "@/lib/scan/domains-allowlist";
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

// --- minimal local masking (defense in depth) ---
function maskEmails(s: string): string {
  return s.replace(
    /([A-Z0-9._%+-]{1,64})@([A-Z0-9.-]{1,253})\.([A-Z]{2,24})/gi,
    (_, u, d, t) => `${(u as string)[0] ?? "•"}••@${(d as string)[0] ?? "•"}••.${t}`
  );
}
function maskPhones(s: string): string {
  return s.replace(/\b\d[\d\s\-()]{9,}\b/g, (m) => m.replace(/\d/g, "•"));
}
function coarseMask(s: string): string {
  return maskPhones(maskEmails(s));
}
function redactPreviewToken(s?: string | null): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (!t) return undefined;
  return (t[0] ?? "•") + "•";
}

// --- types the endpoint accepts (all redacted already from normalize.ts UI) ---
type HitPreview = { email?: string; name?: string; city?: string };
type PrepareBody = {
  broker: string;              // e.g., "Justdial"
  category?: string;           // "directory" | "broker" | "social" | "search"
  url: string;                 // allowlisted evidence URL
  preview: HitPreview;         // redacted preview tokens only
  why?: string[];              // redacted bullets (optional)
  reply?: {
    channel?: "email" | "portal" | "phone";
    emailPreview?: string;     // redacted email preview
  };
  locale?: string;             // default "en-IN"
  intent?: "remove_or_correct" | "remove" | "correct";
};

/**
 * POST /api/concierge/prepare
 * Body: PrepareBody (all redacted / allowlisted)
 *
 * Steps:
 * 1) Validate + allowlist URL, sanitize inputs.
 * 2) Server-only AI (JSON mode) to produce subject/body/fields (no PII).
 * 3) Insert row into actions (RLS applies), computing ledger (hash + sig).
 * 4) Return created action row.
 */
export async function POST(req: Request) {
  const rl = await ensureAiLimit(req);
  if (!rl?.ok) {
    return json({ ok: false, error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  let body: PrepareBody | null = null;
  try {
    body = (await req.json()) as PrepareBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.broker || !body?.url || !body?.preview) {
    return json({ ok: false, error: "Missing broker, url, or preview" }, { status: 400 });
  }
  if (!isAllowed(body.url)) {
    return json({ ok: false, error: "URL not allowlisted" }, { status: 400 });
  }

  const safeWhy = (Array.isArray(body.why) ? body.why : []).slice(0, 3).map(coarseMask);
  const evidence = [{ url: body.url, note: safeWhy[0] || "Allowlisted listing reference" }];

  const safeContext = {
    namePreview: redactPreviewToken(body.preview.name) ?? "N•",
    emailPreview: redactPreviewToken(body.preview.email) ?? "e•@•",
    cityPreview: redactPreviewToken(body.preview.city) ?? "C•",
    exposureNotes: safeWhy,
  };

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const MODEL = process.env.OPENAI_MODEL_ID || "gpt-4o-mini";
  const SYSTEM = [
    "You are an India-first privacy assistant creating data-removal/correction drafts.",
    "Return ONLY JSON with keys: subject (string), body (string), fields (object), attachments (array).",
    "Never include raw PII; only use redacted previews provided.",
    "Keep tone concise, respectful, and legally grounded. 1800 char max body.",
  ].join(" ");

  const userPayload = {
    broker: body.broker,
    category: body.category || "directory",
    locale: body.locale || "en-IN",
    intent: body.intent || "remove_or_correct",
    context: safeContext,
    evidence,
    preferences: {
      attachmentsAllowed: true,
      replyEmailPreview: redactPreviewToken(body.reply?.emailPreview) ?? undefined,
      replyChannel: body.reply?.channel || "email",
    },
  };

  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 600,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          "Generate JSON: { subject, body, fields, attachments }",
          "fields: action ('remove'|'correct'|'remove_or_correct'), data_categories (string[]), legal_basis (string), reply_to_hint (string).",
          "Do not include raw PII.",
          JSON.stringify(userPayload),
        ].join("\n"),
      },
    ],
  });

  let draft: {
    subject: string;
    body: string;
    fields: { action: string; data_categories: string[]; legal_basis: string; reply_to_hint: string };
    attachments: { name: string; kind: string; rationale: string }[];
  };
  try {
    const raw = completion.choices?.[0]?.message?.content || "{}";
    const obj = JSON.parse(raw);
    draft = {
      subject: coarseMask(`${obj.subject || "Data Removal Request"}`.slice(0, 140)),
      body: coarseMask(`${obj.body || ""}`.slice(0, 1800)),
      fields: {
        action: obj?.fields?.action || "remove_or_correct",
        data_categories: Array.isArray(obj?.fields?.data_categories)
          ? obj.fields.data_categories.slice(0, 8).map((x: any) => `${x}`.trim()).filter(Boolean)
          : ["personal information"],
        legal_basis: obj?.fields?.legal_basis || "Right to correction/erasure",
        reply_to_hint: obj?.fields?.reply_to_hint || "Use the provided reply channel",
      },
      attachments: Array.isArray(obj?.attachments)
        ? obj.attachments.slice(0, 2).map((a: any) => ({
            name: `${a?.name || "attachment"}`.slice(0, 60),
            kind: `${a?.kind || "screenshot"}`.slice(0, 20),
            rationale: `${a?.rationale || ""}`.slice(0, 200),
          }))
        : [],
    };
  } catch {
    return json({ ok: false, error: "AI JSON parse failed" }, { status: 502 });
  }

  // Prepare ledger envelope (PII-safe) and insert action
  const nowIso = new Date().toISOString();
  const envelope = {
    id: "pending",
    broker: body.broker,
    category: body.category || "directory",
    redacted_identity: {
      namePreview: safeContext.namePreview,
      emailPreview: safeContext.emailPreview,
      cityPreview: safeContext.cityPreview,
    },
    evidence_urls: evidence.map((e) => e.url),
    draft_subject_hash: draft.subject ? sha256Hex(draft.subject) : undefined,
    timestamp: nowIso,
  };
  const proof = signEnvelope(envelope);

  const row = {
    broker: body.broker,
    category: body.category || "directory",
    status: "prepared",
    redacted_identity: {
      namePreview: safeContext.namePreview,
      emailPreview: safeContext.emailPreview,
      cityPreview: safeContext.cityPreview,
    },
    evidence,
    draft_subject: draft.subject,
    draft_body: draft.body,
    fields: draft.fields,
    reply_channel: body.reply?.channel || "email",
    reply_email_preview: body.reply?.emailPreview || null,
    proof_hash: proof.hash,
    proof_sig: proof.sig,
  };

  const db = supa();
  const { data, error } = await db.from("actions").insert(row).select("*").maybeSingle();
  if (error) return json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, action: data });
}
