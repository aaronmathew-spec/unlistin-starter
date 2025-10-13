// src/agents/request/draft.ts
import { createClient } from "@supabase/supabase-js";
import { synthesizePolicies } from "../policy/synth";
import { renderEmailBody, renderEmailSubject, renderFormPayload, SubjectProfile } from "./templates";

export type DraftInput = {
  subjectId: string;
};

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

async function getSubjectProfile(subjectId: string): Promise<SubjectProfile> {
  const supabase = db();
  const { data, error } = await supabase
    .from("subjects")
    .select("legal_name,email,phone_number")
    .eq("id", subjectId)
    .single();
  if (error) throw new Error(`[draft] cannot fetch subject: ${error.message}`);
  return {
    name: (data as any)?.legal_name ?? null,
    email: (data as any)?.email ?? null,
    phone: (data as any)?.phone_number ?? null,
  };
}

/**
 * Create 'draft' actions per controller policy. For MVP we support:
 * - email channel -> {subject, body}
 * - form channel  -> {formUrl, fields{...}}
 *
 * Writes to actions (status = 'draft'). If your actions schema differs, adapt the fields below.
 */
export async function createDraftActions(input: DraftInput) {
  const supabase = db();

  const [policies, profile] = await Promise.all([
    synthesizePolicies({ subjectId: input.subjectId }),
    getSubjectProfile(input.subjectId),
  ]);

  if (policies.length === 0) {
    return { inserted: 0, policies: 0 };
  }

  const rows = policies.map((p) => {
    if (p.channel === "email") {
      const toEmail = p.channels?.email || p.channels?.privacy || null;
      const subject = renderEmailSubject(p.controller_name);
      const body = renderEmailBody(p.controller_name, profile, "en");

      return {
        id: crypto.randomUUID(),
        subject_id: input.subjectId,
        controller_id: p.controller_id,
        channel: "email",
        to: toEmail,
        content: body,
        payload: { subject, to: toEmail, body },
        status: "draft",
      };
    }

    if (p.channel === "form") {
      const formUrl = p.channels?.formUrl || p.url || null;
      const payload = formUrl ? renderFormPayload(formUrl, profile) : null;

      return {
        id: crypto.randomUUID(),
        subject_id: input.subjectId,
        controller_id: p.controller_id,
        channel: "form",
        to: formUrl,
        content: "",
        payload,
        status: "draft",
      };
    }

    // Fallback: prepare a generic API draft (to be implemented later)
    return {
      id: crypto.randomUUID(),
      subject_id: input.subjectId,
      controller_id: p.controller_id,
      channel: "api",
      to: p.channels?.apiEndpoint || null,
      content: "",
      payload: {
        endpoint: p.channels?.apiEndpoint || null,
        method: "POST",
        body: { requestType: "deletion", identifiers: profile },
      },
      status: "draft",
    };
  });

  // Insert drafts
  const { error } = await supabase.from("actions").insert(rows);
  if (error) throw new Error(`[draft] insert into actions failed: ${error.message}`);

  return { inserted: rows.length, policies: policies.length };
}
