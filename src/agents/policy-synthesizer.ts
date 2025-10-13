// src/agents/policy-synthesizer.ts
import type { AgentState, AgentResult } from "./types";
import { createClient } from "@supabase/supabase-js";
import { generateJSON } from "@/lib/llm";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

type ControllerRow = {
  id: string;
  name: string;
  domain: string | null;
  country: string | null;
  channel_types: string[];
  contact_urls: string[];
  privacy_url: string | null;
  dsar_url: string | null;
  auth_type: string | null;
  status: string;
  metadata: Record<string, any>;
};

type SynthesizedPolicy = {
  version: number;
  controllerId: string;
  preferredChannel: "email" | "webform" | "portal" | "other";
  requiredFields: Array<{
    key: string;
    type: "string" | "email" | "phone" | "file" | "enum";
    required: boolean;
    hints?: string;
  }>;
  evidence: {
    identity: Array<"email-otp" | "sms-otp" | "gov-id" | "selfie" | "none">;
    consent?: "not-required" | "implicit" | "explicit";
  };
  serviceLevels: {
    acknowledgementHours?: number;
    responseDays?: number;
    deletionDays?: number;
  };
  contact: {
    to?: string | null;
    url?: string | null;
  };
  escalation?: {
    method: "email" | "webform" | "portal" | "none";
    to?: string | null;
    url?: string | null;
  };
  notes?: string;
};

async function getSubject(subjectId: string) {
  const { data, error } = await db
    .from("subjects")
    .select("email, phone_number, legal_name")
    .eq("id", subjectId)
    .single();
  if (error) throw new Error(`[policy] subject fetch failed: ${error.message}`);
  return {
    email: (data as any)?.email as string | null,
    phone: (data as any)?.phone_number as string | null,
    name: (data as any)?.legal_name as string | null,
  };
}

async function discoveredControllers(subjectId: string): Promise<string[]> {
  const { data, error } = await db
    .from("discovered_items")
    .select("controller_id")
    .eq("subject_id", subjectId)
    .not("controller_id", "is", null);
  if (error) throw new Error(`[policy] discovered_items load failed: ${error.message}`);
  const ids = (data || []).map((r: any) => r.controller_id as string).filter(Boolean);
  return Array.from(new Set(ids));
}

async function loadController(id: string): Promise<ControllerRow | null> {
  const { data, error } = await db.from("controllers").select("*").eq("id", id).single();
  if (error) return null;
  return data as any;
}

async function latestPolicyFor(controllerId: string): Promise<any | null> {
  const { data } = await db
    .from("controller_policies")
    .select("id, version, policy, synthesized_at")
    .eq("controller_id", controllerId)
    .order("synthesized_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function writePolicy(controllerId: string, policy: SynthesizedPolicy, source: any) {
  const { error } = await db.from("controller_policies").insert({
    controller_id: controllerId,
    version: policy.version ?? 1,
    policy,
    source,
  });
  if (error) throw new Error(`[policy] insert failed: ${error.message}`);
}

function fallbackPolicy(
  controller: ControllerRow,
  subject: { email: string | null; phone: string | null; name: string | null }
): SynthesizedPolicy {
  const channel: SynthesizedPolicy["preferredChannel"] =
    controller.channel_types?.includes("email")
      ? "email"
      : controller.channel_types?.includes("webform")
      ? "webform"
      : controller.channel_types?.includes("portal")
      ? "portal"
      : "other";

  const contact = {
    to: channel === "email" ? (controller.metadata?.contact_email || null) : null,
    url:
      channel !== "email"
        ? controller.dsar_url || controller.contact_urls?.[0] || controller.privacy_url || null
        : null,
  };

  return {
    version: 1,
    controllerId: controller.id,
    preferredChannel: channel,
    requiredFields: [
      { key: "full_name", type: "string", required: true },
      { key: "email", type: "email", required: !!subject.email },
      { key: "phone", type: "phone", required: !!subject.phone },
    ],
    evidence: {
      identity: controller.auth_type === "email-verify" ? ["email-otp"] : controller.auth_type === "captcha" ? ["none"] : ["none"],
    },
    serviceLevels: { responseDays: 30, deletionDays: 45 },
    contact,
    escalation: { method: "none" },
    notes: "Fallback policy synthesized without external fetch.",
  };
}

async function synthesizePolicy(
  controller: ControllerRow,
  subject: { email: string | null; phone: string | null; name: string | null }
) {
  const system = `You are a compliance orchestration system. Produce a strict JSON policy describing how to submit a Data Deletion (DSAR) request to the given controller.
- Use keys exactly as in the schema shown to you.
- Prefer the controller's declared DSAR or privacy contact endpoints.
- Infer the identity requirements from auth_type if present (email-verify, captcha, none).
- Provide service level targets where unspecified (acknowledgement ~72h, response 30d, deletion 45d).`;

  const user = JSON.stringify({
    schema: "SynthesizedPolicy",
    controller: {
      name: controller.name,
      domain: controller.domain,
      country: controller.country,
      channel_types: controller.channel_types,
      dsar_url: controller.dsar_url,
      privacy_url: controller.privacy_url,
      contact_urls: controller.contact_urls,
      auth_type: controller.auth_type,
      metadata: controller.metadata || {},
    },
    subject: { email: subject.email, phone: subject.phone, name: subject.name },
  });

  const fallback = fallbackPolicy(controller, subject);
  const result = await generateJSON<SynthesizedPolicy>({
    system,
    user,
    fallback,
  });

  const normalized: SynthesizedPolicy = {
    version: typeof result.version === "number" ? result.version : 1,
    controllerId: controller.id,
    preferredChannel: (["email", "webform", "portal", "other"] as const).includes(
      result.preferredChannel as any
    )
      ? (result.preferredChannel as any)
      : fallback.preferredChannel,
    requiredFields:
      Array.isArray(result.requiredFields) && result.requiredFields.length
        ? result.requiredFields
        : fallback.requiredFields,
    evidence: result.evidence || fallback.evidence,
    serviceLevels: result.serviceLevels || fallback.serviceLevels,
    contact: {
      to: result?.contact?.to ?? fallback.contact.to,
      url: result?.contact?.url ?? fallback.contact.url,
    },
    escalation: result.escalation || fallback.escalation,
    notes: result.notes || fallback.notes,
  };

  const source = {
    synthesizedWith: process.env.OPENAI_MODEL || "gpt-4o-mini",
    at: new Date().toISOString(),
  };

  await writePolicy(controller.id, normalized, source);
  return normalized;
}

export async function policySynthesizerAgent(state: AgentState): Promise<AgentResult> {
  try {
    const subject = await getSubject(state.subjectId);
    const controllerIds = await discoveredControllers(state.subjectId);

    for (const cid of controllerIds) {
      const ctrl = await loadController(cid);
      if (!ctrl) continue;

      const existing = await latestPolicyFor(cid);
      if (existing) continue;

      await synthesizePolicy(ctrl, subject);
    }

    const nextState: Partial<AgentState> = {
      stage: "request_generation",
      metadata: {
        ...state.metadata,
        lastUpdatedAt: new Date(),
        progress: {
          ...state.metadata.progress,
          policyPercent: 100,
        },
      },
      // NOTE: we do not mutate state.policies here to avoid type mismatch.
      // Draft generation should read from controller_policies table.
    };

    return {
      success: true,
      updatedState: nextState,
      nextAgent: "request_generation",
    };
  } catch (err: any) {
    return {
      success: false,
      updatedState: {
        stage: "failed",
        errors: [
          ...state.errors,
          {
            agent: "policy_synthesizer",
            error: err?.message || String(err),
            timestamp: new Date(),
            recoverable: false,
          },
        ],
      },
      error: err?.message || String(err),
    };
  }
}
