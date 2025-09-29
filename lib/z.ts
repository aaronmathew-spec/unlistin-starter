// lib/z.ts
import { z } from "zod";

export const DraftSuggestionAction = z.object({
  kind: z.literal("draft_suggestion"),
  request_id: z.number().int().positive(),
  text: z.string().min(1),
});
export type DraftSuggestionAction = z.infer<typeof DraftSuggestionAction>;

export const EnqueueTaskInput = z.object({
  type: z.literal("draft_suggestion"),
  request_id: z.number().int().positive(),
  payload: z.object({
    text: z.string().min(1),
  }),
});
export type EnqueueTaskInput = z.infer<typeof EnqueueTaskInput>;
