/**
 * AI Assist endpoint (non-streaming for first cut)
 * Runtime: Node.js (NOT Edge) because supabase-js/tooling may rely on Node APIs.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
};

const SYS_PROMPT = `
You are Unlistin AI Assistant. Be concise, safe, and helpful.
- You can call tools only when explicitly asked by the user to "fetch", "GET", or "check a URL".
- If the user asks about this product, keep answers grounded to features present in the UI.
- Never reveal keys, headers, or internal URLs.
`;

// Optional: very small input validator so requests don't break the function
function parseBody(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const { messages } = raw as any;
  if (!Array.isArray(messages)) return null;
  const result: ChatMessage[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const role = (m as any).role;
    const content = (m as any).content;
    if (!content || typeof content !== "string") continue;
    if (role !== "system" && role !== "user" && role !== "assistant" && role !== "tool") continue;
    result.push({ role, content });
  }
  return result;
}

export async function POST(req: Request) {
  try {
    // Feature flag guard — backend can be deployed dark
    if (process.env.FEATURE_AI_SERVER !== "1") {
      return NextResponse.json(
        { error: "AI server feature disabled. Set FEATURE_AI_SERVER=1 to enable." },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const messages = parseBody(body);
    if (!messages?.length) {
      return NextResponse.json({ error: "Invalid payload: messages[]" }, { status: 400 });
    }

    // Use OpenAI if key present. If not, return a friendly stub so UI still works.
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        answer:
          "AI is almost ready. Add OPENAI_API_KEY in Vercel env and set FEATURE_AI_SERVER=1 to enable real responses.",
      });
    }

    // Compose final message array
    const finalMessages = [
      { role: "system", content: SYS_PROMPT },
      ...messages,
    ] as ChatMessage[];

    // Call OpenAI Chat Completions (non-streaming for now)
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // light/cheap by default; you can upgrade to gpt-4.1 or o4-mini for better quality
        messages: finalMessages,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: `OpenAI error: ${txt}` },
        { status: 500 }
      );
    }

    const json = await res.json();
    const answer =
      json?.choices?.[0]?.message?.content ??
      "I couldn't find a response. Please try again.";

    return NextResponse.json({ answer });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
