/**
 * Stub adapter: Education/alumni surfaces (public alumni pages).
 * Uses deterministic, non-fetch patterns for common Indian alumni portals.
 */
import { isAllowed } from "@/lib/scan/domains-allowlist";

export type EducationPreviewHit = {
  domain: string;
  label: string;
  url: string;
  kind: "education";
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

function labelFor(host: string): string {
  if (host.includes("iitb")) return "IIT Bombay Alumni";
  if (host.includes("iitd")) return "IIT Delhi Alumni";
  if (host.includes("iitm")) return "IIT Madras Alumni";
  if (host.includes("iisc")) return "IISc Alumni";
  return "Alumni Directory";
}

export async function queryEducationPreview(input: Input): Promise<EducationPreviewHit[]> {
  const out: EducationPreviewHit[] = [];
  const { email, name, city } = input;

  if (!name) return out;
  const q = encodeURIComponent(name);

  const hosts = [
    "alumni.iitb.ac.in",
    "alumni.iitm.ac.in",
    "alumni.iitd.ac.in",
    "alumni.iisc.ac.in",
  ];

  for (const host of hosts) {
    const url = `https://${host}/?q=${q}`;
    if (!isAllowed(url)) continue;

    out.push({
      domain: host,
      label: labelFor(host),
      url,
      kind: "education",
      fields: {
        email,
        name,
        city,
        snippet: `${name} possibly mentioned on ${labelFor(host)}.`,
      },
      risk: "low",
    });
  }

  return out;
}
