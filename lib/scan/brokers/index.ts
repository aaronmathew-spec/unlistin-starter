import { PeoplePreviewInput, queryPeoplePreview, type PeoplePreviewHit } from "@/lib/scan/brokers/people_preview";
import { queryCompaniesPreview, type CompaniesPreviewHit } from "@/lib/scan/brokers/companies_preview";
import { queryEducationPreview, type EducationPreviewHit } from "@/lib/scan/brokers/education_preview";

export type AnyPreviewHit =
  | (PeoplePreviewHit & { _source: "people" })
  | (CompaniesPreviewHit & { _source: "companies" })
  | (EducationPreviewHit & { _source: "education" });

export async function queryAllPreviews(input: PeoplePreviewInput): Promise<AnyPreviewHit[]> {
  const [a, b, c] = await Promise.all([
    queryPeoplePreview(input),
    queryCompaniesPreview(input),
    queryEducationPreview(input),
  ]);

  // Annotate with source and merge
  const all: AnyPreviewHit[] = [
    ...a.map((h) => ({ ...h, _source: "people" as const })),
    ...b.map((h) => ({ ...h, _source: "companies" as const })),
    ...c.map((h) => ({ ...h, _source: "education" as const })),
  ];

  // Deduplicate by absolute URL
  const seen = new Set<string>();
  const out: AnyPreviewHit[] = [];
  for (const h of all) {
    if (!seen.has(h.url)) {
      seen.add(h.url);
      out.push(h);
    }
  }
  return out;
}
