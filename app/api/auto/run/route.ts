/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureAiLimit } from "@/lib/ratelimit";
import { isAllowed } from "@/lib/scan/domains-allowlist";
import { selectAutoCandidates } from "@/lib/auto/policy";
import OpenAI from "openai";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { sha256Hex, signEnvelope } from "@/lib/ledger";

// Admin gating (kill-switch, caps, min-confidence)
import { gateCandidates } from "@/lib/auto/selector";
import { getCapability } from "@/lib/auto/capability";

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

type NormalizedHitLite = {
  broker: string;
  url: string;
  kind?: string;
  confidence: number;
  why?: string[];
  preview: { email?: string; name?: string; city?: string };
  adapter?: string;
  state?: string;
};

type Body = {
  hits: NormalizedHitLite[];         // server-provided normalized hits (redacted)
  userState?: string | null;         // optional state inferred from user Deep Scan consent
  maxCount?: number;
  globalMinConfidence?: number;
  intent?: "remove_or_correct" | "remove" | "correct";
};

/**
 * POST /api/auto/run
 * Body: { hits: NormalizedHit[] (redacted), ... }
 *
 * Keeps your existing contract & AI flow.
 * Adds admin gating before draft generation:
 *  - kill-switch
 *  - per-adapter daily caps
 *  - min-confidence override (falls back to capability defaults)
 */
export async function POST(req: Request) {
  const rl = await ensureAiLimit(req);
  if (!rl?.ok) return json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });

  let body: Body | null = null;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.hits || !Array.isArray(body.hits)) {
    return json({ ok: false, error: "Missing hits" }, { status: 400 });
  }

  // Your existing candidate selection
  const initial = selectAutoCandidates({
    hits: body.hits as any,
    maxCount: body.maxCount ?? 8,
    userState: body.userState || null,
    globalMinConfidence: body.globalMinConfidence ?? 0.82,
  });

  if (initial.length === 0) {
    return json({ ok: true, prepared: 0, actions: [] });
  }

  // Map to gateCandidates input (preserve your fields like preview/why)
  const mapped = initial.map((c) => {
    const hit = c.hit as NormalizedHitLite;
    return {
      broker: hit.broker,
      category: hit.kind || "directory",
      adapter: (hit.adapter || inferAdapterFrom(hit.broker, hit.url)).toLowerCase(),
      state: hit.state || null,
      confidence: Number.isFinite(hit.confidence) ? Number(hit.confidence) : 1,
      url: hit.url,
      evidence: [{ url: hit.url }],
      // carry through for downstream use
      why: hit.why,
      preview: hit.preview,
      reply_channel: "email" as const,
    } as any;
  });

  // Admin gating (kill, caps, min-confidence) + allowlist
  const gated = await gateCandidates(mapped);
  if (gated.length === 0) {
    return json({ ok: true, prepared: 0, actions: [] });
  }

  const MODEL = process.env.OPENAI_MODEL_ID || "gpt-4o-mini";
  const SYSTEM = [
    "You are an India-first privacy assistant creating data-removal/correction drafts.",
    "Return ONLY JSON: { subject, body, fields, attachments }.",
    "Never include raw PII; only redacted previews.",
    "Max body 1800 chars, respectful and precise.",
  ].join(" ");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const db = supa();
  const prepared: any[] = [];

  for (const h of gated) {
    const url = firstUrl(h);
    if (!url || !isAllowed(url)) continue; // strict allowlist enforcement

    const safeContext = {
      namePreview: redactPreview(h.preview?.name) ?? "N•",
      emailPreview: redactPreview(h.preview?.email) ?? "e•@•",
      cityPreview: redactPreview(h.preview?.city) ?? "C•",
      exposureNotes: (h.why || []).slice(0, 3).map(coarseMask),
    };

    const userPayload = {
      broker: h.broker || "Unknown",
      category: h.category || "directory",
      locale: "en-IN",
      intent: body.intent || "remove_or_correct",
      context: safeContext,
      evidence: [{ url, note: safeContext.exposureNotes[0] || "Allowlisted listing" }],
      preferences: { attachmentsAllowed: true, replyChannel: "email", replyEmailPreview: safeContext.emailPreview },
    };

    // Capability lookup (kept for potential future use)
    void getCapability((h as any).__adapter || h.adapter || "generic");

    // Server-only AI draft generation (JSON mode)
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
            "No raw PII; only use the redacted previews.",
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
          action: obj?.fields?.action || (body.intent || "remove_or_correct"),
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
      continue; // skip this candidate if the AI response is malformed
    }

    // Proof-of-Action (PII-safe) — ensure broker is a definite string
    const env = {
      id: "pending",
      broker: h.broker || "Unknown",
      category: h.category || "directory",
      redacted_identity: {
        namePreview: safeContext.namePreview,
        emailPreview: safeContext.emailPreview,
        cityPreview: safeContext.cityPreview,
      },
      evidence_urls: [url],
      draft_subject_hash: draft.subject ? sha256Hex(draft.subject) : undefined,
      timestamp: new Date().toISOString(),
    };
    const proof = signEnvelope(env);

    // Insert prepared action (RLS applies) — ensure broker is a string
    const row = {
      broker: h.broker || "Unknown",
      category: h.category || "directory",
      status: "prepared",
      redacted_identity: {
        namePreview: safeContext.namePreview,
        emailPreview: safeContext.emailPreview,
        cityPreview: safeContext.cityPreview,
      },
      evidence: [{ url, note: safeContext.exposureNotes[0] || "Allowlisted listing" }],
      draft_subject: draft.subject,
      draft_body: draft.body,
      fields: draft.fields,
      reply_channel: "email" as const,
      reply_email_preview: safeContext.emailPreview,
      proof_hash: proof.hash,
      proof_sig: proof.sig,
      // Store adapter & confidence for later jobs
      adapter: (h as any).__adapter || h.adapter || "generic",
      confidence: Number.isFinite(h.confidence) ? Number(h.confidence) : null,
      meta: { threshold: (h as any).__threshold || null, state: h.state || null, source: "auto-run" },
    };

    const { data, error } = await db.from("actions").insert(row).select("*").maybeSingle();
    if (!error && data) prepared.push(data);
  }

  return NextResponse.json({ ok: true, prepared: prepared.length, actions: prepared });
}

// --- helpers ---
function firstUrl(h: any): string | null {
  const u = (Array.isArray(h.evidence) && h.evidence[0]?.url) || h.url || null;
  return u || null;
}
function redactPreview(s?: string) {
  if (!s) return undefined;
  const t = s.trim();
  if (!t) return undefined;
  return (t[0] ?? "•") + "•";
}
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
function inferAdapterFrom(broker?: string, url?: string) {
  const s = (broker || url || "").toLowerCase();
  if (s.includes("justdial")) return "justdial";
  if (s.includes("sulekha")) return "sulekha";
  if (s.includes("indiamart")) return "indiamart";
  return "generic";
}
