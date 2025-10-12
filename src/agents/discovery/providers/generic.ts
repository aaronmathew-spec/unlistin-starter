// src/agents/discovery/providers/generic.ts
import { CandidateItem, DiscoveryInput, DiscoveryProvider } from "../types";
import { scoreBySignals } from "@/lib/confidence";

export const GenericSynthesisProvider: DiscoveryProvider = {
  id: "provider:generic",

  async discover(input: DiscoveryInput): Promise<CandidateItem[]> {
    // Fallback: propose high-signal places for verification to check later.
    const items: CandidateItem[] = [];

    // Email-centric profiles
    if (input.email) {
      const email = encodeURIComponent(input.email);
      items.push({
        controllerName: "GenericEmailSearch",
        source: this.id,
        url: `https://duckduckgo.com/?q="${email}"`,
        dataType: "email",
        confidence: scoreBySignals({
          emailMatch: true,
          phoneMatch: false,
          namePresent: Boolean(input.name),
          controllerTier: 2,
        }),
        evidence: { hint: "Generic web search for email footprint." },
      });
    }

    // Name + phone combos
    const q = [input.name, input.phone].filter(Boolean).join(" ");
    if (q) {
      items.push({
        controllerName: "GenericListingSearch",
        source: this.id,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
        dataType: input.phone ? "phone" : "listing",
        confidence: scoreBySignals({
          emailMatch: false,
          phoneMatch: Boolean(input.phone),
          namePresent: Boolean(input.name),
          controllerTier: 2,
        }),
        evidence: { hint: "Generic web search for name/phone footprint." },
      });
    }

    return items;
  },
};
