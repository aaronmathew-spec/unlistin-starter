// app/api/agents/plan/route.ts
import { NextResponse } from "next/server";
import { FEATURE_AGENTS_SERVER, FEATURE_AI_SERVER } from "@/lib/flags";
import { AgentPlanInput, AgentPlan, ToolAction } from "@/lib/agents/types";
import { isAllowedTool } from "@/lib/mcp/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!FEATURE_AGENTS_SERVER) {
    return NextResponse.json({ error: "Agents feature disabled" }, { status: 501 });
  }

  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => ({}));
  const parsed = AgentPlanInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { request_id, goal } = parsed.data;

  // (A) Optional model call (requires FEATURE_AI_SERVER + provider key) to propose steps.
  // For safety and portability, we ship a deterministic stub if key missing.
  let steps: { idx: number; action: ToolAction }[] = [
    { idx: 0, action: { tool: "coverage_note", params: { text: `Summary for request #${request_id}: ${goal}` } } },
    { idx: 1, action: { tool: "http_get", params: { url: "https://example.com/robots.txt" } } },
    { idx: 2, action: { tool: "send_email_draft", params: { to: "user@example.com", subject: "Draft outreach", body: "Hello,\n\nHere's a first draft based on the goal.\n\n" } } },
  ];

  if (FEATURE_AI_SERVER && process.env.OPENAI_API_KEY) {
    try {
      // Minimal prompt that yields JSON steps; keep hard guardrails
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You output ONLY valid JSON matching schema { steps: [{ idx:number, action:{ tool:'http_get'|'send_email_draft'|'coverage_note', params:object } }] }. Never call tools not in the list. Never include credentials or PII." },
            { role: "user", content: `Propose 2-4 safe steps to progress request ${request_id}. Goal: ${goal}. Allowed tools: http_get(url), send_email_draft(to,subject,body), coverage_note(text).` },
          ],
          max_tokens: 600,
        }),
      });
      const j = await resp.json();
      const content = j?.choices?.[0]?.message?.content;
      if (content) {
        const json = JSON.parse(content);
        if (Array.isArray(json?.steps)) {
          // Validate each action via Zod (AgentPlan will Zod-check again)
          steps = json.steps;
        }
      }
    } catch {
      // fall back to stub
    }
  }

  // (B) Validate plan against schemas and allowlist
  const plan = AgentPlan.parse({ request_id, goal, steps });
  for (const s of plan.steps) {
    if (!isAllowedTool(s.action.tool)) {
      return NextResponse.json({ error: `Tool not allowed: ${s.action.tool}` }, { status: 400 });
    }
  }

  // (C) Persist plan + steps
  const { data: planRow, error: e1 } = await supabase
    .from("agent_plans")
    .insert({ request_id, goal, status: "proposed" })
    .select("*")
    .maybeSingle();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });

  const stepRows = plan.steps.map((s) => ({
    plan_id: planRow!.id,
    idx: s.idx,
    tool_key: s.action.tool,
    action: s.action as unknown as object,
    status: "proposed" as const,
  }));
  const { data: stepsInserted, error: e2 } = await supabase
    .from("agent_plan_steps")
    .insert(stepRows)
    .select("*");
  if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });

  return NextResponse.json({ plan: planRow, steps: stepsInserted });
}
