/* eslint-disable @typescript-eslint/no-explicit-any */

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ensureAiLimit } from "@/lib/ratelimit";

export const runtime = "nodejs"; // supabase-js & some libs don't like Edge

type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

function envBool(v: string | undefined): boolean {
  return v === "1" || v?.toLowerCase() === "true";
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

const MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function POST(req: Request) {
  // Feature flag: hard-stop if backend AI is not enabled
  if (!envBool(process.env.FEATURE_AI_SERVER)) {
    return json(
      { error: "AI server feature is disabled (set FEATURE_AI_SERVER=1 to enable)" },
      { status: 503 }
    );
  }

  // Rate limit this endpoint (IP/user aware via ensureAiLimit)
  const { ok } = await ensureAiLimit(req);
  if (!ok) {
    return json(
      { error: "Rate limit exceeded. Please try again shortly." },
      { status: 429 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return json(
      { error: "OPENAI_API_KEY not configured. Set it in your environment." },
      { status: 500 }
    );
  }

  // Parse body safely
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const messages = (body as any)?.messages as ChatTurn[] | undefined;

  // Basic validation
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "Body must include non-empty `messages` array" }, { status: 400 });
  }

  // Lightweight input hardening
  const sanitized: ChatTurn[] = messages
    .filter((m) => m && typeof m.content === "string" && typeof m.role === "string")
    .map((m) => ({
      role:
        m.role === "user" || m.role === "assistant" || m.role === "system"
          ? m.role
          : ("user" as const),
      content: m.content.slice(0, 8000), // keep request small
    }));

  // Add a brief system primer to keep the model helpful & safe
  const systemPrimer: ChatTurn = {
    role: "system",
    content:
      "You are a concise, helpful assistant for the Unlistin app. " +
      "Prefer short, direct answers. If you don’t know, say so briefly.",
  };

  try {
    const openai = new OpenAI({ apiKey });

    // Use Chat Completions API (keeps compatibility & maturity)
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 800,
      messages: [systemPrimer, ...sanitized],
    });

    const answer =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I couldn’t generate a response. Please try again.";

    return json({ answer });
  } catch (e: any) {
    // Fallback to safe message + include error text for debugging
    return json(
      {
        error: "AI call failed",
        details: e?.message?.slice?.(0, 2000) ?? String(e),
      },
      { status: 502 }
    );
  }
}
