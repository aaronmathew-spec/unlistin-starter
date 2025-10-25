// src/lib/targets/types.ts
export const runtime = "nodejs";

export type Channel = "email" | "webform" | "api";

export type TargetCategory =
  | "caller-id"
  | "big-social"
  | "india-social"
  | "messaging"
  | "search-index"
  | "people-search"
  | "creator-db"
  | "jobs"
  | "classifieds"
  | "commerce"
  | "dating"
  | "misc";

export type RequirementHint =
  | "full-name"
  | "account-email"
  | "phone"
  | "handle"
  | "id-proof"
  | "urls-screenshots";

export type TargetEntry = {
  key: string;                 // unique machine key (e.g., "truecaller")
  name: string;                // human label (e.g., "Truecaller")
  category: TargetCategory;
  preferredChannel: Channel;
  allowedChannels: Channel[];  // priority order
  regions?: string[];          // ISO country codes or broad regions (e.g., "IN")
  requires: RequirementHint[]; // identity/evidence hints
  notes?: string;              // quirks/policy notes
  help?: {                     // official docs or help center URLs
    privacy?: string;
    removal?: string;
    terms?: string;
    grievance?: string;
  };
};
