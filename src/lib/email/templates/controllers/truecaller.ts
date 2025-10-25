// src/lib/email/templates/controllers/truecaller.ts
import { resolvePolicyByRegion, type LawKey } from "@/src/lib/policy/dsr";
import { lawHeader, lineBreaks, signatureBlock } from "@/src/lib/email/templates/common";

export type TruecallerEmailArgs = {
  region: LawKey | string;     // e.g., "IN" or "DPDP_IN"
  subjectFullName?: string;
  subjectEmail?: string;
  subjectPhone?: string;
  identifiers?: Record<string, string | undefined>;
};

export function buildTruecallerRemovalEmail(args: TruecallerEmailArgs): { subject: string; body: string } {
  const policy = resolvePolicyByRegion(args.region);
  const subject = `Data Erasure Request — Truecaller`;
  const who = args.subjectFullName ? `${args.subjectFullName}` : "the data subject";

  const body = lineBreaks(
    `Hello Privacy Team,`,
    "",
    `I am ${who}. ${lawHeader(policy)}`,
    "",
    "Please remove my phone presence/identity and associated data from Truecaller, and cease processing.",
    args.subjectPhone ? `Phone: ${args.subjectPhone}` : null,
    args.subjectEmail ? `Email: ${args.subjectEmail}` : null,
    ...(Object.entries(args.identifiers || {}).map(([k, v]) => `• ${k}: ${v ?? ""}`)),
    "",
    "Please confirm completion within the statutory timeline and provide a brief summary of the action taken.",
    signatureBlock()
  );

  return { subject, body };
}
