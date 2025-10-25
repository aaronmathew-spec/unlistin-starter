// src/lib/email/templates/sla.ts
// Simple SLA-oriented templates (plain text). Jurisdiction-neutral phrasing,
// pairs with the authorization footer added by sendEmailWithAuthorization().

export const runtime = "nodejs";

export type NudgeArgs = {
  controllerName: string;
  subjectFullName: string;
  subjectEmail?: string | null;
  subjectPhone?: string | null;
  requestId?: string | null;         // your internal id, if any
  originalSubmittedAt?: string | null; // ISO
  links?: string[];                  // evidence or profile URLs (optional)
  nextActionHint?: string | null;    // optional instruction (e.g., “confirm identity link”)
};

export function buildNudgeSubject(a: NudgeArgs): string {
  const who =
    a.subjectFullName ||
    a.subjectEmail ||
    a.subjectPhone ||
    "data subject";
  return `[Reminder] Data deletion request for ${who}`;
}

export function buildNudgeBody(a: NudgeArgs): string {
  const lines: string[] = [];
  lines.push(`Hello ${a.controllerName} team,`);
  lines.push("");
  lines.push(
    "This is a reminder regarding the data deletion/unlisting request submitted for the data subject below.",
  );
  lines.push("");
  lines.push(`Subject: ${a.subjectFullName}`);
  if (a.subjectEmail) lines.push(`Email: ${a.subjectEmail}`);
  if (a.subjectPhone) lines.push(`Phone: ${a.subjectPhone}`);
  if (a.requestId) lines.push(`Request ID: ${a.requestId}`);
  if (a.originalSubmittedAt)
    lines.push(`Original submission: ${new Date(a.originalSubmittedAt).toISOString()}`);
  if (a.links?.length) {
    lines.push("");
    lines.push("Reference links:");
    for (const u of a.links) lines.push(`- ${u}`);
  }
  if (a.nextActionHint) {
    lines.push("");
    lines.push(`Next action requested: ${a.nextActionHint}`);
  }
  lines.push("");
  lines.push(
    "Kindly acknowledge and complete deletion in line with your policy and applicable data protection law.",
  );
  lines.push("");
  lines.push("Thank you.");
  return lines.join("\n");
}
