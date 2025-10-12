// lib/openai-client.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import OpenAI from "openai";
import { z } from "zod";

/**
 * Singleton OpenAI client (Node runtime only).
 */
let _client: OpenAI | null = null;
export function getOpenAI(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

export type StructuredCallOptions<T> = {
  /** Zod schema for the expected JSON shape */
  schema: z.ZodType<T>;
  /** System prompt to steer behavior (optional) */
  system?: string;
  /** User/content messages (the last one is typically the "task") */
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  /** Model to use (defaults to a small, fast model) */
  model?: string;
  /** Temperature (defaults 0.2) */
  temperature?: number;
  /** Max output tokens (optional) */
  maxTokens?: number;
};

/**
 * Call the LLM and parse the reply as JSON using the provided Zod schema.
 * We request JSON output and then validate it defensively.
 */
export async function callLLMWithStructuredOutput<T>(
  opts: StructuredCallOptions<T>
): Promise<T> {
  const {
    schema,
    messages,
    system = "You are a concise assistant. Always output valid JSON with no extra commentary.",
    model = process.env.OPENAI_MODEL_NAME?.trim() || "gpt-4o-mini",
    temperature = 0.2,
    maxTokens,
  } = opts;

  const client = getOpenAI();

  // We’ll use Chat Completions with json_object response format for broad compatibility.
  const res = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      // Add a final reminder to produce pure JSON:
      ...messages,
      {
        role: "system",
        content:
          "Return ONLY valid JSON that matches the requested schema. Do not include prose, backticks, or code fencing.",
      },
    ],
  });

  const raw =
    res.choices?.[0]?.message?.content ??
    // older SDKs sometimes put the text in this extension field:
    (res as any).choices?.[0]?.message?.content ??
    "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // If somehow non-JSON slipped through, try a naive extraction fallback
    const candidate = String(raw).replace(/^[^{\[]+/, "").replace(/[^}\]]+$/, "");
    parsed = JSON.parse(candidate);
  }

  const zres = schema.safeParse(parsed);
  if (!zres.success) {
    // Surface a helpful error with truncated model output for debugging
    const preview = String(raw).slice(0, 400);
    throw new Error(
      `LLM JSON did not match schema: ${zres.error.message}\nOutput preview: ${preview}`
    );
  }

  return zres.data;
}

/**
 * Convenience helper for simple, unstructured prompts (returns plain text).
 */
export async function callLLMText(prompt: string, params?: { model?: string; temperature?: number; maxTokens?: number }) {
  const client = getOpenAI();
  const res = await client.chat.completions.create({
    model: params?.model ?? process.env.OPENAI_MODEL_NAME?.trim() ?? "gpt-4o-mini",
    temperature: params?.temperature ?? 0.3,
    max_tokens: params?.maxTokens,
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt },
    ],
  });
  return res.choices?.[0]?.message?.content ?? "";
}
