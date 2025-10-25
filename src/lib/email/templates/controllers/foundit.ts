// src/lib/email/templates/controllers/foundit.ts
import { resolvePolicyByRegion, type LawKey } from "@/src/lib/policy/dsr";
import { lawHeader, lineBreaks, signatureBlock } from "@/src/lib/email/templates/common";

export type FounditEmailArgs = {
  region: LawKey | string;
  subjectFullName?: string;
  subjectEmail?: string;
  identifiers?: Record<string, string | undefined>;
};

export function buildFounditRemovalEmail(args: FounditEmailArgs): { subject: string; body: string } {
  const policy = resolvePolicyByRegion(args.region);
  const subject = `Data Erasure Request — Foundit (Monster India)`;
  const who = args.subjectFullName ? `${args.subjectFullName}` : "the data subject";

  const body = lineBreaks(
    `Hello Foundit Privacy Team,`,
    "",
    `I am ${who}. ${lawHeader(policy)}`,
    "",
    "Please delete my resume/profile and all associated personal data, and cease processing.",
    args.subjectEmail ? `Account Email: ${args.subjectEmail}` : null,
    ...(Object.entries(args.identifiers || {}).map(([k, v]) => `• ${k}: ${v ?? ""}`)),
    "",
    "Please confirm completion within the statutory timeline and provide a brief summary of the action taken.",
    signatureBlock()
  );

  return { subject, body };
}
