// app/api/ai/drafts/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureAiLimit } from "@/lib/ratelimit";
import { isAllowed } from "@/lib/scan/domains-allowlist";
import { type DraftRemovalRequest, type DraftRemovalResponse } from "@/lib/drafts";

// We keep this file dependency-light and avoid adding new packages.
// Uses the same OpenAI client pattern as existing AI endpoints.
import OpenAI from "openai";

// ------------------------ local masking helpers ------------------------
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
  // One pass of coarse masking; we do not persist inputs, only mask before AI.
  return maskPhones(maskEmails(s));
}
function redactPreviewToken(s?: string | null): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (!t) return undefined;
  // Keep only first letter + dot for human readability
  return t[0] + "•";
}
// ----------------------------------------------------------------------

const MODEL = process.env.OPENAI_MODEL_ID || "gpt-4o-mini";

const SYSTEM = [
  "You are a privacy assistant generating data-removal request drafts for India-first brokers/directories.",
  "Return ONLY JSON that strictly matches the schema. Do not include Markdown or prose.",
  "Never include raw PII; use the redacted tokens provided (email/name/city previews).",
  "Prefer Indian legal phrasing and concise, respectful tone. Keep body under 1800 chars.",
].join(" ");

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
 * POST /api/ai/drafts
 * Body: DraftRemovalRequest (see lib/drafts.ts)
 * - Inputs MUST be redacted already by caller, but we defensively re-mask.
 * - Evidence links MUST be on the allowlist; non-allowlisted links are dropped.
 *
 * Returns: DraftRemovalResponse (subject/body/fields/attachments)
 * No persistence. Server-only AI call in JSON mode. Rate-limited.
 */
export async function POST(req: Request) {
  const rl = await ensureAiLimit(req);
  if (!rl?.ok) {
    return json(
      { ok: false, error: "Rate limit exceeded. Try again shortly." },
      { status: 429 }
    );
  }

  let body: DraftRemovalRequest | null = null;
  try {
    body = (await req.json()) as DraftRemovalRequest;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || !body.broker || !body.context) {
    return json(
      { ok: false, error: "Missing required fields: broker, context" },
      { status: 400 }
    );
  }

  // Defensive re-masking & allowlist enforcement
  const safeEvidence = (body.evidence || [])
    .filter((e) => e && typeof e.url === "string" && isAllowed(e.url))
    .map((e) => ({
      url: e.url,
      note: coarseMask(e.note || ""),
    }));

  const safeContext = {
    namePreview: redactPreviewToken(body.context.namePreview) ?? "N•",
    emailPreview: redactPreviewToken(body.context.emailPreview) ?? "e•@•",
    cityPreview: redactPreviewToken(body.context.cityPreview) ?? "C•",
    exposureNotes: (body.context.exposureNotes || [])
      .slice(0, 8)
      .map((n) => coarseMask(`${n}`))
      .filter(Boolean),
  };

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userPayload = {
    broker: body.broker,
    category: body.category || "directory",
    locale: body.locale || "en-IN",
    intent: body.intent || "remove_or_correct",
    context: safeContext,
    evidence: safeEvidence,
    preferences: {
      attachmentsAllowed: !!body.preferences?.attachmentsAllowed,
      replyEmailPreview: redactPreviewToken(body.preferences?.replyEmailPreview) ?? undefined,
      replyChannel: body.preferences?.replyChannel || "email",
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
          "Generate a removal/correction draft with JSON keys:",
          "subject (string), body (string), fields (object), attachments (array).",
          "fields should include: action ('remove'|'correct'), data_categories (string[]), legal_basis (string), reply_to_hint (string).",
          "attachments are optional; include only if strictly useful, and never include raw PII.",
          "Keep broker-specific details concise.",
          "",
          "User payload follows:",
          JSON.stringify(userPayload),
        ].join("\n"),
      },
    ],
  });

  let parsed: DraftRemovalResponse["draft"] | null = null;

  try {
    const raw = completion.choices?.[0]?.message?.content || "{}";
    const obj = JSON.parse(raw);
    // Minimal shape check
    parsed = {
      subject: `${obj.subject || "Data Removal Request"}`.slice(0, 140),
      body: `${obj.body || ""}`.slice(0, 1800),
      fields: {
        action: obj?.fields?.action || "remove",
        data_categories: Array.isArray(obj?.fields?.data_categories)
          ? obj.fields.data_categories.slice(0, 8).map((x: any) => `${x}`.trim()).filter(Boolean)
          : ["personal information"],
        legal_basis: obj?.fields?.legal_basis || "Right to correction/erasure",
        reply_to_hint: obj?.fields?.reply_to_hint || "Use the provided reply channel",
      },
      attachments: Array.isArray(obj?.attachments)
        ? obj.attachments.slice(0, 3).map((a: any) => ({
            name: `${a?.name || "attachment"}`.slice(0, 60),
            kind: `${a?.kind || "screenshot"}`.slice(0, 20),
            rationale: `${a?.rationale || ""}`.slice(0, 200),
          }))
        : [],
    };
  } catch {
    return json({ ok: false, error: "AI JSON parse failed" }, { status: 502 });
  }

  // Final coarse mask on subject/body (defense in depth)
  parsed.subject = coarseMask(parsed.subject);
  parsed.body = coarseMask(parsed.body);

  return NextResponse.json({
    ok: true,
    draft: parsed,
  } satisfies DraftRemovalResponse);
}
