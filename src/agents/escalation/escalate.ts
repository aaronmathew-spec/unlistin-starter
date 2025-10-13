// src/agents/escalation/escalate.ts
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/agents/dispatch/email";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

type ControllerChannels = {
  email?: string | null;
  privacy?: string | null;
  grievanceEmail?: string | null;
  dpoEmail?: string | null;
  formUrl?: string | null;
  apiEndpoint?: string | null;
  [k: string]: any;
};

function pickEscalationEmails(channels?: ControllerChannels | null): string[] {
  if (!channels) return [];
  const candidates = [
    channels.grievanceEmail,
    channels.dpoEmail,
    channels.privacy,
    channels.email,
  ].filter(Boolean) as string[];
  // de-dup + sanitize
  return Array.from(new Set(candidates.map((s) => s.trim()))).filter((s) => s.length > 3);
}

export async function escalateOverduesForSubject(subjectId: string) {
  const supabase = db();

  // Load escalate_pending actions with controller info + subject identifiers (for context)
  const { data: actions, error } = await supabase
    .from("actions")
    .select(
      `
      id, subject_id, controller_id, channel, to, payload, status, created_at,
      controllers:controller_id ( id, name, channels, escalation_path ),
      subjects:subject_id ( legal_name, email, phone_number )
    `
    )
    .eq("subject_id", subjectId)
    .eq("status", "escalate_pending");

  if (error) throw new Error(`[escalate] load actions failed: ${error.message}`);
  if (!actions || actions.length === 0) return { checked: 0, escalated: 0, skipped: 0 };

  let escalated = 0;
  let skipped = 0;

  for (const a of actions) {
    const ctrl = (a as any).controllers;
    const channels: ControllerChannels | null = (ctrl?.channels as any) ?? null;
    const recipients = pickEscalationEmails(channels);

    if (recipients.length === 0) {
      // No escalation email available; mark as needs_review so an operator can decide.
      await supabase.from("actions").update({ status: "needs_review" }).eq("id", a.id);
      skipped++;
      continue;
    }

    const subjProfile = (a as any).subjects || {};
    const who =
      subjProfile?.legal_name ||
      (subjProfile?.email ? `owner of ${subjProfile.email}` : null) ||
      (subjProfile?.phone_number ? `owner of ${subjProfile.phone_number}` : "the user");

    const subject = `Escalation: Data Deletion Overdue – ${ctrl?.name ?? "Controller"}`;
    const body = [
      `Hello ${ctrl?.name ?? "Controller"} team,`,
      ``,
      `This is an escalation for an overdue data deletion/unlisting request as per your SLA.`,
      ``,
      `Subject: ${who}`,
      `Original channel: ${a.channel}`,
      a.to ? `Original destination: ${a.to}` : undefined,
      `Action ID: ${a.id}`,
      ``,
      `Please acknowledge and process this request at the earliest.`,
      `— UnlistIN automated escalator`,
    ]
      .filter(Boolean)
      .join("\n");

    // Send to first recipient (MVP: single message; could fan-out if needed)
    const to = recipients[0]!;
    const sent = await sendEmail({ to, subject, body });

    if (!sent.ok) {
      await supabase
        .from("actions")
        .update({ status: "failed", dispatch_info: { channel: "email", error: sent.error, escalation: true } })
        .eq("id", a.id);
      skipped++;
      continue;
    }

    await supabase
      .from("actions")
      .update({
        status: "escalated",
        dispatch_info: { channel: "email", receipt: sent.messageId, escalation: true, to },
        escalation_info: {
          to,
          at: new Date().toISOString(),
          controller: ctrl?.name ?? null,
          path: ctrl?.escalation_path ?? [],
        },
      })
      .eq("id", a.id);

    escalated++;
  }

  return { checked: actions.length, escalated, skipped };
}
