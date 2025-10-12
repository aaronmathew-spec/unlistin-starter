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

    const choice = completion.choices[0];
    if (!choice || !choice.message.content) {
      throw new Error("No response from OpenAI");
    }

    return {
      content: choice.message.content,
      usage: {
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
      },
    };
  } catch (error) {
    console.error("[OpenAI] Error calling LLM:", error);
    throw error;
  }
}

export async function callLLMWithStructuredOutput<T>(
  request: LLMRequest,
  schema: z.ZodType<T>
): Promise<{ data: T; usage: LLMResponse["usage"] }> {
  const response = await callLLM(request);

  try {
    let jsonText = response.content.trim();
    
    // Remove markdown code fences
    jsonText = jsonText.replace(/^```json\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    jsonText = jsonText.replace(/^```\s*\n?/i, "").replace(/\n?```\s*$/i, "");

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

export function calculateCost(usage: LLMResponse["usage"], model: string): number {
  const pricing: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4-turbo": { input: 10, output: 30 },
  };

  const rates = pricing[model] || pricing["gpt-4o-mini"];
  const inputCost = (usage.inputTokens / 1_000_000) * rates.input;
  const outputCost = (usage.outputTokens / 1_000_000) * rates.output;

  return inputCost + outputCost;
}

export default client;
