// src/lib/email/templates/removal.ts
/* Jurisdiction-aware removal (erasure) email */
import { resolvePolicyByRegion, type LawKey } from "@/src/lib/policy/dsr";
import { lawHeader, lineBreaks, signatureBlock } from "./common";

export type RemovalTemplateArgs = {
  controllerName: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  countryOrLaw?: string | LawKey | null;
  identifiers?: Record<string, string | null | undefined>;
};

export function renderRemovalEmail(args: RemovalTemplateArgs): { subject: string; body: string } {
  const law = resolvePolicyByRegion(args.countryOrLaw || "DPDP_IN");
  const who = [args.fullName, args.email, args.phone].filter(Boolean).join(" / ");

  const subject = `Request for removal of personal data - ${args.fullName ?? "Data Subject"}`;

  const body = lineBreaks(
    `Hello ${args.controllerName} Team,`,
    "",
    `I am ${who}. ${lawHeader(law)}`,
    "",
    "Please delete and cease processing my personal data and any public listings/profiles associated with me.",
    "If you require additional verification, reply with the specific details needed.",
    "",
    "Identifiers (if applicable):",
    ...(Object.entries(args.identifiers || {}).map(([k, v]) => `• ${k}: ${v ?? ""}`)),
    "",
    "Please confirm completion within the statutory timeline and provide a brief summary of the action taken.",
    signatureBlock()
  );

  return { subject, body };
}
