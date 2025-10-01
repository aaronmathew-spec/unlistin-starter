/**
 * Stub adapter: Indian corporate registries and company intelligence.
 * Synthesizes predictable public-company profile URLs without network calls.
 */
import { isAllowed } from "@/lib/scan/domains-allowlist";

export type CompaniesPreviewHit = {
  domain: string;
  label: string;
  url: string;
  kind: "business" | "public_record";
  fields?: {
    email?: string;
    name?: string;
    city?: string;
    snippet?: string;
  };
  risk?: "low" | "medium" | "high";
};

type Input = {
  email: string;
  name?: string;
  city?: string;
};

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Simple heuristic: if the name has 2+ tokens, treat as possible director/employee
export async function queryCompaniesPreview(input: Input): Promise<CompaniesPreviewHit[]> {
  const out: CompaniesPreviewHit[] = [];
  const { email, name, city } = input;
  const nameSlug = name ? toSlug(name) : undefined;

  // ZaubaCorp person search (pattern)
  if (nameSlug) {
    const zUrl = `https://www.zaubacorp.com/companysearchresults/${encodeURIComponent(nameSlug)}`;
    if (isAllowed(zUrl)) {
      out.push({
        domain: "zaubacorp.com",
        label: "ZaubaCorp",
        url: zUrl,
        kind: "public_record",
        fields: {
          email,
          name,
          city,
          snippet: `${name} may appear in Indian corporate filings (ZaubaCorp).`,
        },
        risk: "low",
      });
    }
  }

  // QuickCompany person/company search (pattern)
  if (nameSlug) {
    const qcUrl = `https://www.quickcompany.in/director/${encodeURIComponent(nameSlug)}`;
    if (isAllowed(qcUrl)) {
      out.push({
        domain: "quickcompany.in",
        label: "QuickCompany",
        url: qcUrl,
        kind: "public_record",
        fields: {
          email,
          name,
          city,
          snippet: `${name} potential director/officer listing on QuickCompany.`,
        },
        risk: "low",
      });
    }
  }

  return out;
}
