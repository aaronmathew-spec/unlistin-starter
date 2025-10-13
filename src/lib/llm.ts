// src/lib/llm.ts
import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (client) return client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null; // allow runtime without key (no hard crash)
  client = new OpenAI({ apiKey: key });
  return client;
}

export async function generateJSON<T>(opts: {
  system: string;
  user: string;
  fallback: T;
}): Promise<T> {
  const ai = getOpenAI();
  if (!ai) return opts.fallback;

  try {
    const resp = await ai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    });

    const raw = resp.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return opts.fallback;
  }
}
