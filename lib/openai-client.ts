// lib/openai-client.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import OpenAI from "openai";
import { z } from "zod";

/** ---------- OpenAI singleton ---------- */
let _client: OpenAI | null = null;
export function getOpenAI(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  _client = new OpenAI({ apiKey });
  return _client;
}

/** ---------- Types ---------- */
export type StructuredCallOptions<T> = {
  schema: z.ZodType<T>;
  system?: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

/** ---------- Helper (supports 1-arg and 2-arg styles) ---------- */
// Overload signatures
export async function callLLMWithStructuredOutput<T>(
  opts: StructuredCallOptions<T>
): Promise<T>;
export async function callLLMWithStructuredOutput<T>(
  opts: Omit<StructuredCallOptions<T>, "schema">,
  schema: z.ZodType<T>
): Promise<T>;

// Implementation
export async function callLLMWithStructuredOutput<T>(
  arg1:
    | StructuredCallOptions<T>
    | Omit<StructuredCallOptions<T>, "schema">,
  arg2?: z.ZodType<T>
): Promise<T> {
  // Normalize to single options object with schema
  const hasSecond = !!arg2;
  const opts = (hasSecond
    ? { ...(arg1 as any), schema: arg2 }
    : (arg1 as StructuredCallOptions<T>)) as StructuredCallOptions<T>;

  const {
    schema,
    messages,
    system = "You are a concise assistant. Always output valid JSON with no extra commentary.",
    model = process.env.OPENAI_MODEL_NAME?.trim() || "gpt-4o-mini",
    temperature = 0.2,
    maxTokens,
  } = opts;

  const client = getOpenAI();

  const res = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      ...messages,
      {
        role: "system",
        content:
          "Return ONLY valid JSON that matches the requested schema. Do not include prose, backticks, or code fencing.",
      },
    ],
  });

  const raw = res.choices?.[0]?.message?.content ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const candidate = String(raw).replace(/^[^{\[]+/, "").replace(/[^}\]]+$/, "");
    parsed = JSON.parse(candidate);
  }

  const zres = schema.safeParse(parsed);
  if (!zres.success) {
    const preview = String(raw).slice(0, 400);
    throw new Error(
      `LLM JSON did not match schema: ${zres.error.message}\nOutput preview: ${preview}`
    );
  }
  return zres.data;
}

/** ---------- Simple text helper ---------- */
export async function callLLMText(
  prompt: string,
  params?: { model?: string; temperature?: number; maxTokens?: number }
) {
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
