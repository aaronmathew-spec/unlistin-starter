// lib/agents/types.ts
import { z } from "zod";

/** Tool payload schemas (Zod) */
export const HttpGet = z.object({
  tool: z.literal("http_get"),
  params: z.object({
    url: z.string().url(),
  }),
});

export const SendEmailDraft = z.object({
  tool: z.literal("send_email_draft"),
  params: z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    body: z.string().min(1),
  }),
});

export const CoverageNote = z.object({
  tool: z.literal("coverage_note"),
  params: z.object({
    text: z.string().min(1),
  }),
});

export const ToolAction = z.discriminatedUnion("tool", [HttpGet, SendEmailDraft, CoverageNote]);

/** Full plan payload produced by agent */
export const AgentPlanInput = z.object({
  request_id: z.number().int().positive(),
  goal: z.string().min(1),
});

export const AgentPlan = z.object({
  request_id: z.number().int().positive(),
  goal: z.string().min(1),
  steps: z.array(
    z.object({
      idx: z.number().int().min(0),
      action: ToolAction,
    })
  ).min(1),
});

export type ToolAction = z.infer<typeof ToolAction>;
export type AgentPlanInput = z.infer<typeof AgentPlanInput>;
export type AgentPlan = z.infer<typeof AgentPlan>;
