// src/lib/targets/dispatch.ts
// Map Target Matrix entries to your dispatcher inputs and call sendControllerRequest.

import sendControllerRequest from "@/lib/dispatch/send";

export const runtime = "nodejs";

export type SubjectProfile = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  handles?: string[] | null;
  subjectId?: string | null;     // your canonical user id (preferred for idempotency)
};

export type PlanItem = {
  key: string;                   // controller key (e.g., "truecaller", "naukri", etc.)
  name?: string | null;          // human label (optional)
  // optional hints carried from planner
  preferredChannel?: "email" | "webform" | "api";
  requires?: string[];
};

export type DispatchResult = {
  controllerKey: string;
  controllerName: string;
  ok: boolean;
  channel: "webform" | "email" | "noop";
  providerId: string | null;
  error: string | null;
  note: string | null;
  idempotent?: "deduped" | "new";
};

export async function dispatchPlanItem(args: {
  item: PlanItem;
  subject: SubjectProfile;
  locale?: string | null;               // default "en-IN"
  // Optional precomposed draft for email/webform
  draft?: { subject?: string | null; bodyText?: string | null } | null;
  formUrl?: string | null;              // if you want to pin a specific webform URL
  action?: string | null;               // for idempotency dimension
}): Promise<DispatchResult> {
  const controllerKey = String(args.item.key || "").toLowerCase();
  const controllerName = args.item.name || controllerKey;

  const res = await sendControllerRequest({
    controllerKey,
    controllerName,
    subject: {
      name: args.subject.fullName,
      email: args.subject.email ?? undefined,
      phone: args.subject.phone ?? undefined,
      handle: (args.subject.handles && args.subject.handles[0]) || undefined,
      id: args.subject.subjectId ?? undefined,
    },
    locale: (args.locale || "en-IN") as string,
    draft: args.draft ?? null,
    formUrl: args.formUrl ?? null,
    action: args.action ?? "create_request_v1",
    subjectId: args.subject.subjectId ?? null,
  });

  return {
    controllerKey,
    controllerName,
    ok: res.ok,
    channel: res.channel,
    providerId: res.providerId,
    error: res.error,
    note: res.note,
    idempotent: res.idempotent,
  };
}
