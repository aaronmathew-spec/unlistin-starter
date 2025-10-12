// src/agents/policy-synthesizer/index.ts
import { AgentState, AgentResult, Policy } from "../types";
import { callLLMWithStructuredOutput } from "@/lib/openai-client";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Database helper
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

const PolicyOutputSchema = z.object({
  channel: z.enum(["email", "webform", "api", "legal_letter", "phone"]),
  contact: z.object({
    email: z.string().email().optional(),
    formUrl: z.string().url().optional(),
  }),
  template: z.string().min(50),
  identityProof: z.enum(["none", "email_verify", "phone_verify", "aadhaar_masked", "digilocker"]),
  slaDays: z.number().int().min(1).max(90),
  escalationPath: z.array(z.string()),
  reasoning: z.string(),
});

async function synthesizePolicyWithLLM(
  source: string,
  sourceType: string
): Promise<z.infer<typeof PolicyOutputSchema>> {
  const systemPrompt = `You are an expert in India's DPDP Act 2023 and data privacy regulations.

Generate a deletion request policy for a data controller.

Guidelines:
1. Comply with DPDP Act 2023 Section 14 (Right to Erasure)
2. Be professional and legally sound
3. Include escalation paths: Grievance Officer → DPO → DPB
4. Specify realistic SLA based on controller type
5. Choose the most effective communication channel

Controller Types & Typical SLAs:
- caller_id, directory: 7-30 days
- employment, e_commerce: 30 days
- social_media: 14-30 days
- financial: 30-60 days`;

  const userPrompt = `Generate deletion policy for:

Source: ${source}
Source Type: ${sourceType}

Output JSON schema:
{
  "channel": "email" | "webform" | "api",
  "contact": {
    "email": "privacy@example.com",
    "formUrl": "https://..." (if webform)
  },
  "template": "Full email template with {{phone}}, {{email}}, {{name}} placeholders. Must cite DPDP Act Section 14. Professional tone. 200-500 words.",
  "identityProof": "email_verify",
  "slaDays": 30,
  "escalationPath": ["grievance_officer", "dpo", "dpb"],
  "reasoning": "Explain your choices"
}`;

  // ⬇️ Updated: pass a single options object with `schema`,
  // and use the returned parsed object directly (no `.data`)
  const result = await callLLMWithStructuredOutput<z.infer<typeof PolicyOutputSchema>>({
    systemPrompt,
    userPrompt,
    schema: PolicyOutputSchema,
    maxTokens: 3000,
    temperature: 0.2,
  });

  return result;
}

export async function policySynthesizerAgent(state: AgentState): Promise<AgentResult> {
  console.log(`[Policy Synthesizer] Starting for ${state.discoveredItems.length} items`);

  try {
    const newPolicies: Policy[] = [];
    const supabase = db();

    // Get items needing policies
    const existingSources = new Set(state.policies.map((p) => p.source));
    const itemsNeedingPolicies = state.discoveredItems
      .filter((item) => !existingSources.has(item.source))
      .slice(0, 5); // Limit to 5 per run

    if (itemsNeedingPolicies.length === 0) {
      return {
        success: true,
        updatedState: { stage: "request_generation" },
        nextAgent: "request_generator",
      };
    }

    // Generate policies
    for (const item of itemsNeedingPolicies) {
      try {
        console.log(`[Policy Synthesizer] Generating policy for ${item.source}`);

        const policyData = await synthesizePolicyWithLLM(item.source, item.sourceType);

        const controllerId =
          (globalThis as any)?.crypto?.randomUUID?.() ??
          Math.random().toString(36).slice(2);

        const policy: Policy = {
          controllerId,
          source: item.source,
          channel: policyData.channel,
          contact: policyData.contact,
          template: policyData.template,
          identityProof: policyData.identityProof,
          slaDays: policyData.slaDays,
          escalationPath: policyData.escalationPath,
          generatedAt: new Date(),
        };

        newPolicies.push(policy);

        // Insert controller if doesn't exist
        await supabase.from("controllers").upsert({
          id: controllerId,
          name: item.source,
          category: item.sourceType,
          tier: 3,
          channels: policyData.contact,              // assumes jsonb column
          sla_days: policyData.slaDays,
          identity_requirements: policyData.identityProof,
          policy_template: policyData.template,
          escalation_path: policyData.escalationPath,
        });
      } catch (error) {
        console.error(`[Policy Synthesizer] Error for ${item.source}:`, error);
      }
    }

    console.log(`[Policy Synthesizer] Generated ${newPolicies.length} policies`);

    // Be defensive if metadata/progress might be missing
    const prevProgress = (state.metadata?.progress as any) || {};
    const policyPercent = Math.min(
      ((state.policies.length + newPolicies.length) / Math.max(state.discoveredItems.length, 1)) * 100,
      100
    );

    return {
      success: true,
      updatedState: {
        stage: "request_generation",
        policies: [...state.policies, ...newPolicies],
        metadata: {
          ...(state.metadata || {}),
          lastUpdatedAt: new Date(),
          progress: {
            ...prevProgress,
            policyPercent,
          },
        },
      },
      nextAgent: "request_generator",
    };
  } catch (error: any) {
    console.error("[Policy Synthesizer] Error:", error);
    return {
      success: false,
      updatedState: {
        errors: [
          ...(state.errors || []),
          {
            agent: "policy_synthesizer",
            error: error.message,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      },
      error: error.message,
    };
  }
}
