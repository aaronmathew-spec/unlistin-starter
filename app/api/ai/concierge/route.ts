// app/api/ai/concierge/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureAiLimit } from "@/lib/ratelimit";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
type ToolCall =
  | { tool: "createRemoval"; args: { broker: string; url: string } }
  | { tool: "requestEvidence"; args: { url: string } }
  | { tool: "checkStatus"; args: { requestId: number } }
  | { tool: "explainBrokerPolicy"; args: { broker: string } };

type Body = {
  messages?: ChatMessage[];
  tool?: ToolCall;
  locale?: string;
};

export async function POST(req: Request) {
  // Rate limit
  const rl = await ensureAiLimit(req);
  if (!rl?.ok) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded." }, { status: 429 });
  }

  const body: Body = await req.json().catch(() => ({} as Body));
  const tool = body.tool;

  // Guarded tool calls (demo-safe; no PII persisted)
  if (tool) {
    switch (tool.tool) {
      case "createRemoval": {
        const { broker, url } = (tool.args ?? {}) as { broker?: string; url?: string };
        if (!broker || !url) {
          return NextResponse.json({ ok: false, error: "Missing broker or url." }, { status: 400 });
        }
        return NextResponse.json({
          ok: true,
          action: "createRemoval",
          next: `/requests/new?broker=${encodeURIComponent(broker)}&url=${encodeURIComponent(url)}&category=Directory%20Listing`,
        });
      }
      case "requestEvidence": {
        const { url } = (tool.args ?? {}) as { url?: string };
        if (!url) return NextResponse.json({ ok: false, error: "Missing url." }, { status: 400 });
        return NextResponse.json({ ok: true, action: "requestEvidence", note: "Evidence retrieval queued (demo)." });
      }
      case "checkStatus": {
        const { requestId } = (tool.args ?? {}) as { requestId?: number };
        if (!Number.isFinite(requestId)) {
          return NextResponse.json({ ok: false, error: "Invalid requestId." }, { status: 400 });
        }
        return NextResponse.json({ ok: true, action: "checkStatus", status: "in_progress" });
      }
      case "explainBrokerPolicy": {
        const { broker } = (tool.args ?? {}) as { broker?: string };
        if (!broker) return NextResponse.json({ ok: false, error: "Missing broker." }, { status: 400 });
        return NextResponse.json({
          ok: true,
          action: "explainBrokerPolicy",
          summary: `${broker} usually honors removal for India residents if the profile is inaccurate or consent is withdrawn. Expect email verification and a 7–30 day SLA.`,
        });
      }
      default:
        return NextResponse.json({ ok: false, error: "Unknown tool." }, { status: 400 });
    }
  }

  // Fallback: minimal assistant reply (build-safe without OpenAI call)
  const lastUser = Array.isArray(body.messages)
    ? [...body.messages].reverse().find((m: ChatMessage) => m.role === "user")
    : undefined;
  const echo = lastUser?.content ?? "";
  const reply =
    "I can create removal drafts, fetch evidence (demo), and track status. Tell me which result to act on, or call a tool.";

  return NextResponse.json({
    ok: true,
    messages: [{ role: "assistant", content: reply, echoOf: echo }],
  });
}
