// src/lib/email/templates/controllers/draft.ts
// Jurisdiction-aware controller email draft builder (plain text, CSP-safe).

import { resolvePolicyByRegion, type PolicyEntry } from "@/src/lib/policy/dsr";
import { lawHeader } from "@/src/lib/email/templates/common";

export const runtime = "nodejs";

export type DraftArgs = {
  controllerKey: string;
  controllerName?: string | null;
  region?: string | null;          // ISO country code (e.g., "IN")
  subjectFullName: string;
  subjectEmail?: string | null;
  subjectPhone?: string | null;
  links?: string[] | null;         // evidence URLs
};

type Draft = { subject: string; bodyText: string };

function lines(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join("\n");
}

function listLinks(u?: string[] | null): string | null {
  if (!u || !u.length) return null;
  return ["Reference links:", ...u.map((x) => `- ${x}`)].join("\n");
}

function lawLine(law: PolicyEntry | null): string {
  return lawHeader(law); // uses the friendly name + key internally
}

export function buildDraftForController(args: DraftArgs): Draft {
  const key = (args.controllerKey || "").toLowerCase();
  const name = args.controllerName || args.controllerKey;
  const law = resolvePolicyByRegion(args.region || "IN");

  switch (key) {
    case "truecaller": {
      const subj = `Request: Unlist & correct spam label for ${args.subjectFullName}`;
      const body = lines(
        `Hello ${name} team,`,
        "",
        lawLine(law),
        "",
        `Please remove/unlist my phone identity from public and correct any spam labeling.`,
        args.subjectPhone ? `Phone: ${args.subjectPhone}` : null,
        args.subjectEmail ? `Email: ${args.subjectEmail}` : null,
        args.subjectFullName ? `Name: ${args.subjectFullName}` : null,
        "",
        listLinks(args.links || null),
        "",
        "Thank you."
      );
      return { subject: subj, bodyText: body };
    }

    case "naukri": {
      const subj = `Request: Delete resume/profile for ${args.subjectFullName}`;
      const body = lines(
        `Hello ${name} Privacy,`,
        "",
        lawLine(law),
        "",
        `Please delete my account/resume data and remove any public profile or searchable references.`,
        args.subjectEmail ? `Account Email: ${args.subjectEmail}` : null,
        args.subjectFullName ? `Name: ${args.subjectFullName}` : null,
        "",
        listLinks(args.links || null),
        "",
        "Please confirm deletion and associated caches within your SLA.",
        "",
        "Thank you."
      );
      return { subject: subj, bodyText: body };
    }

    case "olx": {
      const subj = `Request: Remove listings/profile for ${args.subjectFullName}`;
      const body = lines(
        `Hello ${name} team,`,
        "",
        lawLine(law),
        "",
        `Please remove my profile and associated public listings/content.`,
        args.subjectEmail ? `Account Email: ${args.subjectEmail}` : null,
        args.subjectFullName ? `Name: ${args.subjectFullName}` : null,
        "",
        listLinks(args.links || null),
        "",
        "Kindly confirm removal and disable resurfacing of archived copies.",
        "",
        "Thank you."
      );
      return { subject: subj, bodyText: body };
    }

    default: {
      const subj = `Request: Data removal for ${args.subjectFullName}`;
      const body = lines(
        `Hello ${name} team,`,
        "",
        lawLine(law),
        "",
        `Please remove my personal data and disable public discoverability.`,
        args.subjectEmail ? `Account Email: ${args.subjectEmail}` : null,
        args.subjectPhone ? `Phone: ${args.subjectPhone}` : null,
        args.subjectFullName ? `Name: ${args.subjectFullName}` : null,
        "",
        listLinks(args.links || null),
        "",
        "Thank you."
      );
      return { subject: subj, bodyText: body };
    }
  }
}
