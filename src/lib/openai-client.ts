import OpenAI from "openai";
import { z } from "zod";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  model?: "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo";
}

export interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/** Plain chat call (text in → text out) */
export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
  const {
    systemPrompt,
    userPrompt,
    maxTokens = 4000,
    temperature = 0.3,
    model = "gpt-4o-mini",
  } = request;

  try {
    const completion = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const choice = completion.choices?.[0];
    const content = choice?.message?.content ?? "";

    if (!content.trim()) {
      throw new Error("No response from OpenAI");
    }

    return {
      content,
      usage: {
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
      },
    };
  } catch (error) {
    console.error("[OpenAI] Error calling LLM:", error);
    throw error;
  }
}

/** Chat call that expects JSON and validates it with Zod */
export async function callLLMWithStructuredOutput<T>(
  request: LLMRequest,
  schema: z.ZodType<T>
): Promise<{ data: T; usage: LLMResponse["usage"] }> {
  const response = await callLLM(request);

  try {
    let jsonText = response.content.trim();

    // Strip common ```json fences
    jsonText = jsonText.replace(/^```json\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    jsonText = jsonText.replace(/^```\s*\n?/i, "").replace(/\n?```\s*$/i, "");

    // Try to salvage if the model wrapped JSON in prose
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonText);
    const validated = schema.parse(parsed);

    return {
      data: validated,
      usage: response.usage,
    };
  } catch (error: any) {
    console.error("[OpenAI] Failed to parse structured output:", error);
    console.error("Raw response:", response.content);
    throw new Error(`Failed to parse LLM response: ${error.message}`);
  }
}

/** Cost calculator with strict defaults (avoids TS “possibly undefined”) */
export function calculateCost(
  usage: LLMResponse["usage"],
  model: string
): number {
  type Pricing = { input: number; output: number };
  const pricing: Record<string, Pricing> = {
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4-turbo": { input: 10, output: 30 },
  };

  const DEFAULT_RATES: Pricing = { input: 0, output: 0 };

  // Hard default: model → gpt-4o-mini → zero
  const rates: Pricing =
    pricing[model] ?? pricing["gpt-4o-mini"] ?? DEFAULT_RATES;

  const inTok = usage?.inputTokens ?? 0;
  const outTok = usage?.outputTokens ?? 0;

  const inputCost = (inTok / 1_000_000) * rates.input;
  const outputCost = (outTok / 1_000_000) * rates.output;

  return inputCost + outputCost;
}

export default client;
