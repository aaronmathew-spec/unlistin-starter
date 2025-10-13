// src/agents/request/draft.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

type Subject = {
  email: string | null;
  phone: string | null;
  name: string | null;
};

type ControllerPolicyRow = {
  controller_id: string;
  synthesized_at: string;
  policy: {
    version: number;
    controllerId: string;
    preferredChannel: "email" | "webform" | "portal" | "other";
    requiredFields: { key: string; type: string; required: boolean; hints?: string }[];
    evidence: { identity: Array<"email-otp" | "sms-otp" | "gov-id" | "selfie" | "none">; consent?: string };
    serviceLevels: { acknowledgementHours?: number; responseDays?: number; deletionDays?: number };
    contact: { to?: string | null; url?: string | null };
    escalation?: { method: "email" | "webform" | "portal" | "none"; to?: string | null; url?: string | null };
    notes?: string;
  };
};

type Controller = {
  id: string;
  name: string;
  domain: string | null;
  country: string | null;
  dsar_url: string | null;                 // <-- added
  metadata: Record<string, any> | null;
};

function assertNonEmpty<T>(v: T | null | undefined, fallback: T): T {
  return (v as T) ?? fallback;
}

async function getSubject(subjectId: string): Promise<Subject> {
  const { data, error } = await db
    .from("subjects")
    .select("email, phone_number, legal_name")
    .eq("id", subjectId)
    .single();
  if (error) throw new Error(`[draft] failed to fetch subject: ${error.message}`);
  return {
    email: (data as any)?.email ?? null,
    phone: (data as any)?.phone_number ?? null,
    name: (data as any)?.legal_name ?? null,
  };
}

async function controllerIdsForSubject(subjectId: string): Promise<string[]> {
  const { data, error } = await db
    .from("discovered_items")
    .select("controller_id")
    .eq("subject_id", subjectId)
    .not("controller_id", "is", null);
  if (error) throw new Error(`[draft] failed discovered_items: ${error.message}`);
  const ids = (data || []).map((r: any) => r.controller_id as string).filter(Boolean);
  return Array.from(new Set(ids));
}

async function loadControllers(ids: string[]): Promise<Record<string, Controller>> {
  if (ids.length === 0) return {};
  const { data, error } = await db
    .from("controllers")
    .select("id, name, domain, country, dsar_url, metadata")  // <-- include dsar_url
    .in("id", ids);
  if (error) throw new Error(`[draft] controllers load error: ${error.message}`);
  const map: Record<string, Controller> = {};
  for (const r of data || []) map[(r as any).id] = r as any;
  return map;
}

async function latestPolicies(controllerIds: string[]): Promise<Record<string, ControllerPolicyRow>> {
  if (controllerIds.length === 0) return {};
  // Get the latest per controller_id
  const { data, error } = await db
    .from("controller_policies")
    .select("controller_id, synthesized_at, policy")
    .in("controller_id", controllerIds)
    .order("synthesized_at", { ascending: false });
  if (error) throw new Error(`[draft] policies load error: ${error.message}`);

  const latest: Record<string, ControllerPolicyRow> = {};
  for (const row of (data || []) as any[]) {
    const cid = row.controller_id as string;
    if (!latest[cid]) latest[cid] = row as ControllerPolicyRow;
  }
  return latest;
}

async function existingActionControllers(subjectId: string): Promise<Set<string>> {
  // Avoid duplicate actions for same controller+subject
  const { data, error } = await db
    .from("actions")
    .select("controller_id")
    .eq("subject_id", subjectId)
    .in("status", ["draft", "sent", "escalated", "escalate_pending", "needs_review", "verified"]);
  if (error) throw new Error(`[draft] actions lookup error: ${error.message}`);
  const s = new Set<string>();
  for (const r of data || []) {
    const cid = (r as any).controller_id as string | null;
    if (cid) s.add(cid);
  }
  return s;
}

function buildEmailTemplate(ctrl: Controller, policy: ControllerPolicyRow["policy"], subject: Subject) {
  const to = policy.contact.to || ctrl?.metadata?.contact_email || "";
  const subj = `Data Deletion Request for ${assertNonEmpty(subject.name, "Data Subject")}`;
  const lines: string[] = [
    `To: ${to}`,
    "",
    `Subject: ${subj}`,
    "",
    `Hello ${ctrl.name} Privacy Team,`,
    "",
    `I am submitting a request to delete my personal data from ${ctrl.name}.`,
    "",
    `Identifiers:`,
    `- Full Name: ${assertNonEmpty(subject.name, "N/A")}`,
    `- Email: ${assertNonEmpty(subject.email, "N/A")}`,
    `- Phone: ${assertNonEmpty(subject.phone, "N/A")}`,
    "",
    `Request: Please delete all personal data associated with the above identifiers and confirm completion.`,
    "",
    `Proof/Verification: ${policy.evidence.identity.join(", ") || "none required"}`,
    "",
    `Service Levels: acknowledgement ~${policy.serviceLevels.acknowledgementHours ?? 72}h, response ${policy.serviceLevels.responseDays ?? 30}d, deletion ${policy.serviceLevels.deletionDays ?? 45}d.`,
    "",
    `Regards,`,
    `${assertNonEmpty(subject.name, "Data Subject")}`,
  ];
  return { to, subject: subj, body: lines.join("\n") };
}

function buildWebformPayload(ctrl: Controller, policy: ControllerPolicyRow["policy"], subject: Subject) {
  const url =
    policy.contact.url ||
    ctrl.dsar_url ||
    (ctrl.metadata?.contact_form as string | undefined) ||
    (ctrl.metadata?.portal_url as string | undefined) ||
    "";
  const fields: Record<string, any> = {};
  for (const f of policy.requiredFields || []) {
    switch (f.key) {
      case "full_name":
        fields[f.key] = subject.name || "";
        break;
      case "email":
        fields[f.key] = subject.email || "";
        break;
      case "phone":
        fields[f.key] = subject.phone || "";
        break;
      default:
        fields[f.key] = ""; // leave blank; reviewer can enrich if needed
    }
  }
  const notes = `Proof/Verification: ${policy.evidence.identity.join(", ") || "none"}; SLA: ack ~${policy.serviceLevels.acknowledgementHours ?? 72}h, resp ${policy.serviceLevels.responseDays ?? 30}d, del ${policy.serviceLevels.deletionDays ?? 45}d.`;
  return { url, fields, notes };
}

type DraftActionInsert = {
  subject_id: string;
  controller_id: string | null;
  channel: "email" | "phone" | "webform" | "api" | "legal_letter" | "portal" | "other";
  to: string | null;
  status: "draft" | "sent" | "escalate_pending" | "escalated" | "needs_review" | "verified";
  payload: any; // template/fields for the channel
  meta?: any;
};

function materializeDraft(
  ctrl: Controller,
  policyRow: ControllerPolicyRow,
  subjectId: string,
  subject: Subject
): DraftActionInsert {
  const p = policyRow.policy;
  const channel =
    p.preferredChannel === "email"
      ? "email"
      : p.preferredChannel === "webform"
      ? "webform"
      : p.preferredChannel === "portal"
      ? "portal"
      : "other";

  if (channel === "email") {
    const t = buildEmailTemplate(ctrl, p, subject);
    return {
      subject_id: subjectId,
      controller_id: ctrl.id,
      channel,
      to: t.to || null,
      status: "draft",
      payload: {
        subject: t.subject,
        body: t.body,
      },
      meta: {
        controller: { name: ctrl.name, domain: ctrl.domain, country: ctrl.country },
        policyVersion: p.version,
      },
    };
  }

  if (channel === "webform" || channel === "portal") {
    const t = buildWebformPayload(ctrl, p, subject);
    return {
      subject_id: subjectId,
      controller_id: ctrl.id,
      channel,
      to: t.url || null,
      status: "draft",
      payload: {
        url: t.url,
        fields: t.fields,
        notes: t.notes,
      },
      meta: {
        controller: { name: ctrl.name, domain: ctrl.domain, country: ctrl.country },
        policyVersion: p.version,
      },
    };
  }

  // Fallback: other
  return {
    subject_id: subjectId,
    controller_id: ctrl.id,
    channel: "other",
    to: p.contact?.url || p.contact?.to || null,
    status: "draft",
    payload: {
      instructions: "This controller requires a non-standard submission. Review policy notes and portal.",
      contact: p.contact,
      requiredFields: p.requiredFields,
    },
    meta: {
      controller: { name: ctrl.name, domain: ctrl.domain, country: ctrl.country },
      policyVersion: p.version,
      notes: p.notes ?? null,
    },
  };
}

/**
 * Creates draft actions for the subject from latest controller policies.
 * Idempotent per (subject_id, controller_id).
 */
export async function createDraftActions({ subjectId }: { subjectId: string }) {
  const subject = await getSubject(subjectId);
  const controllerIds = await controllerIdsForSubject(subjectId);
  if (controllerIds.length === 0) return;

  const already = await existingActionControllers(subjectId);
  const pending = controllerIds.filter((cid) => !already.has(cid));
  if (pending.length === 0) return;

  const ctrls = await loadControllers(pending);
  const policies = await latestPolicies(pending);

  const inserts: DraftActionInsert[] = [];
  for (const cid of pending) {
    const ctrl = ctrls[cid];
    const pol = policies[cid];
    if (!ctrl || !pol) continue;
    inserts.push(materializeDraft(ctrl, pol, subjectId, subject));
  }

  if (inserts.length > 0) {
    const { error } = await db.from("actions").insert(inserts);
    if (error) throw new Error(`[draft] insert actions failed: ${error.message}`);
  }
}
