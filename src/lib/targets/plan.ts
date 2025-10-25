// src/lib/targets/plan.ts
// Build a per-subject plan from the STARTER_50 catalog without hitting DBs.
// This is read-only logic meant for the Ops "Run" page.

import {
  STARTER_50,
  type TargetEntry,
  type ChannelHint,
  type TargetCategory,
} from "@/src/lib/targets/starter50";

export type SubjectInput = {
  fullName?: string;
  email?: string;
  phone?: string;
  region?: string; // e.g., IN, US-CA, EU, GLOBAL
};

export type PlanItem = {
  key: string;
  name: string;
  category: TargetCategory;
  preferredChannels: ChannelHint[];
  evidence: TargetEntry["evidence"];
  regionMatch: "direct" | "global" | "unscoped";
  reason: string; // short, human text explaining why it’s in the plan
  draft: {
    subject: string;
    bodyText: string;
  };
};

// Very light region match logic; expand as needed.
function regionMatches(regions: string[] | undefined, region?: string): "direct" | "global" | "unscoped" | null {
  if (!regions || regions.length === 0) return "unscoped";
  if (!region) return "unscoped";
  const R = region.toUpperCase();
  if (regions.map((r) => r.toUpperCase()).includes(R)) return "direct";
  if (regions.map((r) => r.toUpperCase()).includes("GLOBAL")) return "global";
  return null;
}

function sanitize(v?: string | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function naiveDraft(entry: TargetEntry, subject: SubjectInput): { subject: string; bodyText: string } {
  const who = sanitize(subject.fullName) ?? "Data Subject";
  const region = sanitize(subject.region) ?? "applicable data-protection law";
  const email = sanitize(subject.email);
  const phone = sanitize(subject.phone);

  const lines: string[] = [];
  lines.push(`Hello ${entry.name} team,`);
  lines.push("");
  lines.push(
    `I am acting for ${who} and am exercising data-subject rights under ${region}. Please remove or restrict processing of personal data associated with the subject.`
  );
  if (email) lines.push(`- Email: ${email}`);
  if (phone) lines.push(`- Phone: ${phone}`);
  lines.push("");
  lines.push(
    "Please confirm receipt and next steps. If you require additional identity proof or authorization, reply with the specific requirement."
  );
  lines.push("");
  lines.push("Regards,");
  lines.push("UnlistIN Ops");
  return {
    subject: `Data subject request for ${who}`,
    bodyText: lines.join("\n"),
  };
}

/**
 * Build a filtered plan from the catalog.
 * Options:
 *  - includeCategories: if provided, only those categories are included.
 *  - channelHint: if provided, entries whose preferred channels do not include it will be de-prioritized (but still shown).
 */
export function buildPlanFromCatalog(
  subject: SubjectInput,
  opts?: {
    includeCategories?: TargetCategory[];
    channelHint?: ChannelHint;
  }
): PlanItem[] {
  const region = sanitize(subject.region);
  const categories = opts?.includeCategories;
  const list: PlanItem[] = [];

  for (const entry of STARTER_50) {
    if (categories && !categories.includes(entry.category)) continue;

    const match = regionMatches(entry.regions, region);
    if (!match) continue; // skip non-matching region entries

    const draft = naiveDraft(entry, subject);
    const reasonParts: string[] = [];
    reasonParts.push(`Category: ${entry.category}`);
    if (match === "direct") reasonParts.push("Region: direct match");
    if (match === "global") reasonParts.push("Region: global coverage");
    if (match === "unscoped") reasonParts.push("Region: not specified");

    const reason = reasonParts.join(" · ");

    list.push({
      key: entry.key,
      name: entry.name,
      category: entry.category,
      preferredChannels: entry.preferredChannels,
      evidence: entry.evidence,
      regionMatch: match,
      reason,
      draft,
    });
  }

  // Optional: nudge items that match caller channelHint
  if (opts?.channelHint) {
    const hint = opts.channelHint;
    list.sort((a, b) => {
      const aw = a.preferredChannels.includes(hint) ? 0 : 1;
      const bw = b.preferredChannels.includes(hint) ? 0 : 1;
      if (aw !== bw) return aw - bw;
      // Otherwise keep original grouping: direct > global > unscoped
      const rank = (m: PlanItem["regionMatch"]) =>
        m === "direct" ? 0 : m === "global" ? 1 : 2;
      return rank(a.regionMatch) - rank(b.regionMatch);
    });
  } else {
    // Default: region strength sort
    list.sort((a, b) => {
      const rank = (m: PlanItem["regionMatch"]) =>
        m === "direct" ? 0 : m === "global" ? 1 : 2;
      return rank(a.regionMatch) - rank(b.regionMatch);
    });
  }

  return list;
}
