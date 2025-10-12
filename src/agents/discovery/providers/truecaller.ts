// src/agents/discovery/providers/truecaller.ts
import { CandidateItem, DiscoveryInput, DiscoveryProvider } from "../types";
import { scoreBySignals } from "@/lib/confidence";

export const TruecallerProvider: DiscoveryProvider = {
  id: "provider:truecaller",

  async discover(input: DiscoveryInput): Promise<CandidateItem[]> {
    // We do not scrape here. We synthesize a deterministic guess URL that the
    // verification step will later fetch/screenshot. This keeps MVP stable.
    const items: CandidateItem[] = [];
    if (!input.phone) return items;

    const normalized = input.phone.replace(/[^\d+]/g, "");
    const url = `https://www.truecaller.com/search/in/${encodeURIComponent(normalized)}`;

    items.push({
      controllerName: "Truecaller",
      source: this.id,
      url,
      dataType: "phone",
      confidence: scoreBySignals({
        phoneMatch: true,
        emailMatch: false,
        namePresent: Boolean(input.name),
        controllerTier: 1,
      }),
      evidence: {
        hint: "Number search URL constructed; verification agent will confirm presence.",
      },
    });

    return items;
  },
};
