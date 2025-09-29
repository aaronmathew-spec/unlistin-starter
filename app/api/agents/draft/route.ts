// app/api/agents/draft/route.ts
import { NextResponse } from "next/server";
import { FEATURE_AI_SERVER } from "@/lib/flags";
import { DraftSuggestionAction, EnqueueTaskInput } from "@/lib/z";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!FEATURE_AI_SERVER) {
    return NextResponse.json({ error: "AI server feature disabled" }, { status: 501 });
  }

  const supabase = createSupabaseServerClient();

  const body = await req.json().catch(() => ({}));
  const request_id = Number(body?.request_id);
  const userPrompt = String(body?.prompt ?? "").trim();

  if (!Number.isFinite(request_id) || !userPrompt) {
    return NextResponse.json({ error: "request_id and prompt are required" }, { status: 400 });
  }

  // (A) Call provider (optional). If no key, fall back to a deterministic stub.
  const apiKey = process.env.OPENAI_API_KEY;
  let suggestion = `Summary & next steps for request #${request_id}:\n- Draft outreach paragraph here.\n- 3 bullet steps tailored to this case.\n\n(Powered by stub; set OPENAI_API_KEY to enable live model.)`;

  if (apiKey) {
    try {
      // Minimal/portable call to OpenAI responses API (no SDK), non-streaming for simplicity
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You write concise, actionable drafts. Output only the draft; no preamble." },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.4,
          max_tokens: 400
        })
      });
      const j = await resp.json();
      const text = j?.choices?.[0]?.message?.content;
      if (typeof text === "string" && text.trim()) suggestion = text.trim();
    } catch {
      // keep stub
    }
  }

  // (B) Validate as an action
  const action = DraftSuggestionAction.parse({
    kind: "draft_suggestion",
    request_id,
    text: suggestion,
  });

  // (C) Enqueue as a task with payload
  const enqueue = EnqueueTaskInput.parse({
    type: "draft_suggestion",
    request_id: action.request_id,
    payload: { text: action.text },
  });

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({ request_id: enqueue.request_id, type: enqueue.type, payload: enqueue.payload, status: "succeeded" })
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("task_runs").insert({
    task_id: task!.id,
    status: "succeeded",
    logs: "Agent produced a draft suggestion.",
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  });

  return NextResponse.json({ task, action });
}
