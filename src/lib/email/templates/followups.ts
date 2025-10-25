// src/lib/email/templates/followups.ts
// Jurisdiction-aware follow-up & escalation templates (plain text, CSP-safe).

import { resolvePolicyByRegion, type LawKey } from "@/src/lib/policy/dsr";
import { lawHeader, lineBreaks, signatureBlock } from "@/src/lib/email/templates/common";

export type FollowupArgs = {
  controllerName: string;
  region: LawKey | string;     // e.g., "IN", "EU", "US-CA" or canonical keys like "DPDP_IN"
  subjectFullName?: string;
  subjectEmail?: string;
  subjectPhone?: string;
  ticketId?: string;           // vendor ticket/case if known
  daysElapsed?: number;        // for phrasing, optional
};

export function buildFollowupEmail(args: FollowupArgs): { subject: string; body: string } {
  const policy = resolvePolicyByRegion(args.region);
  const subject =
    `Follow-up: DSR request – ${args.controllerName}` +
    (args.ticketId ? ` (Ticket ${args.ticketId})` : "");

  const who = args.subjectFullName ? `${args.subjectFullName}` : "the data subject";
  const elapsed = typeof args.daysElapsed === "number" && args.daysElapsed > 0 ? ` (${args.daysElapsed} days elapsed)` : "";

  const body = lineBreaks(
    `Hello ${args.controllerName} Privacy Team,`,
    "",
    `I am ${who}. ${lawHeader(policy)}${elapsed}`,
    "",
    "This is a polite follow-up on my previously submitted data subject request. " +
      "Please confirm status and expected completion within the statutory timeline.",
    args.ticketId ? `Vendor Ticket: ${args.ticketId}` : null,
    args.subjectEmail ? `Account Email: ${args.subjectEmail}` : null,
    args.subjectPhone ? `Phone: ${args.subjectPhone}` : null,
    "",
    "If any additional information is required to locate my account, please let me know.",
    signatureBlock()
  );

  return { subject, body };
}

export type EscalationArgs = FollowupArgs & {
  ccRegulator?: string; // Optional regulator contact copied (plain email string)
};

export function buildEscalationEmail(args: EscalationArgs): { subject: string; body: string } {
  const policy = resolvePolicyByRegion(args.region);
  const subject =
    `Escalation: DSR request – ${args.controllerName}` +
    (args.ticketId ? ` (Ticket ${args.ticketId})` : "");

  const who = args.subjectFullName ? `${args.subjectFullName}` : "the data subject";
  const elapsed = typeof args.daysElapsed === "number" && args.daysElapsed > 0 ? ` (${args.daysElapsed} days elapsed)` : "";

  const body = lineBreaks(
    `Hello ${args.controllerName} Privacy/Compliance,`,
    "",
    `I am ${who}. ${lawHeader(policy)}${elapsed}`,
    "",
    "I am escalating this request due to lack of timely confirmation/resolution within the expected statutory window.",
    "Please prioritize and provide a status update with a completion date.",
    args.ticketId ? `Vendor Ticket: ${args.ticketId}` : null,
    args.subjectEmail ? `Account Email: ${args.subjectEmail}` : null,
    args.subjectPhone ? `Phone: ${args.subjectPhone}` : null,
    args.ccRegulator ? `CC (Regulator/Authority): ${args.ccRegulator}` : null,
    "",
    "Thank you.",
    signatureBlock()
  );

  return { subject, body };
}
