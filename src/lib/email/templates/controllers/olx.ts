// src/lib/email/templates/controllers/olx.ts
import { resolvePolicyByRegion, type LawKey } from "@/src/lib/policy/dsr";
import { lawHeader, lineBreaks, signatureBlock } from "@/src/lib/email/templates/common";

export type OlxEmailArgs = {
  region: LawKey | string;
  subjectFullName?: string;
  subjectEmail?: string;
  identifiers?: Record<string, string | undefined>;
};

export function buildOlxRemovalEmail(args: OlxEmailArgs): { subject: string; body: string } {
  const policy = resolvePolicyByRegion(args.region);
  const subject = `Data Erasure Request — OLX`;
  const who = args.subjectFullName ? `${args.subjectFullName}` : "the data subject";

  const body = lineBreaks(
    `Hello OLX Privacy Team,`,
    "",
    `I am ${who}. ${lawHeader(policy)}`,
    "",
    "Please remove my account/listings and delete associated personal data from OLX systems.",
    args.subjectEmail ? `Account Email: ${args.subjectEmail}` : null,
    ...(Object.entries(args.identifiers || {}).map(([k, v]) => `• ${k}: ${v ?? ""}`)),
    "",
    "Please confirm completion within the statutory timeline and provide a brief summary of the action taken.",
    signatureBlock()
  );

  return { subject, body };
}
