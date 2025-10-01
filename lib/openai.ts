// lib/openai.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

/** Convenience: get embeddings with the standard model */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const client = getOpenAI();
  const res = await client.embeddings.create({
    model: "text-embedding-3-small", // 1536 dims, good $/quality
    input: texts,
  });
  // OpenAI SDK returns data[].embedding
  return res.data.map((d: any) => d.embedding as number[]);
}
