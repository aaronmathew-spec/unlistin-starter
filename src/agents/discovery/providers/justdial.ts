// src/agents/discovery/providers/justdial.ts
import { CandidateItem, DiscoveryInput, DiscoveryProvider } from "../types";
import { scoreBySignals } from "@/lib/confidence";

export const JustDialProvider: DiscoveryProvider = {
  id: "provider:justdial",

  async discover(input: DiscoveryInput): Promise<CandidateItem[]> {
    const items: CandidateItem[] = [];
    // If we have a phone, synthesize a query URL; JD sometimes indexes by name/phone.
    const q = input.phone ?? input.name ?? "";
    if (!q) return items;

    const term = encodeURIComponent(q);
    const url = `https://www.justdial.com/search?q=${term}`;

    items.push({
      controllerName: "JustDial",
      source: this.id,
      url,
      dataType: input.phone ? "phone" : "listing",
      confidence: scoreBySignals({
        phoneMatch: Boolean(input.phone),
        emailMatch: false,
        namePresent: Boolean(input.name),
        controllerTier: 1,
      }),
      evidence: { hint: "Query URL constructed; verification to confirm listing presence." },
    });

    return items;
  },
};
