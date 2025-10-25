// src/lib/email/templates/common.ts
import type { PolicyEntry } from "@/src/lib/policy/dsr";

export function signatureBlock() {
  return [
    "",
    "—",
    "Regards,",
    "UnlistIN Data Subject Agent",
  ].join("\n");
}

export function lawHeader(law: PolicyEntry | null): string {
  if (!law) return "I am exercising my right to erasure under applicable data protection law.";
  return `I am exercising my rights under ${law.name} (${law.key}) as a data subject.`;
}

export function lineBreaks(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join("\n");
}
