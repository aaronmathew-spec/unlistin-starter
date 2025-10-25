// src/lib/targets/starter50.ts
// Typed, category-driven "Top 50" catalog for young-India focus.
// Read-only until we wire into planner/dispatcher.

export type TargetCategory =
  | "caller_id"
  | "big_social"
  | "india_short_video"
  | "messaging_public"
  | "search_index"
  | "people_search"
  | "creator_db"
  | "jobs_professional"
  | "ecommerce_classifieds"
  | "dating_matrimony"
  | "misc_adtech";

export type ChannelHint = "webform" | "email" | "portal_api";
export type EvidenceKind =
  | "id_government"
  | "id_selfie_match"
  | "authority_letter"
  | "email_control"
  | "phone_otp"
  | "links_screenshots"
  | "copyright_proof";

export type TargetEntry = {
  key: string;                 // short machine key
  name: string;                // human label
  category: TargetCategory;
  regions?: string[];          // e.g., ["IN"], ["IN","GLOBAL"]
  preferredChannels: ChannelHint[]; // routing preference (advisory)
  typicalSLA_days?: number;    // rough SLA for ack/resolve (advisory)
  evidence: EvidenceKind[];    // common proofs needed
  notes?: string;              // playbook reminder
  links?: { help?: string; form?: string }; // public refs (no external fetch)
};

// Helper for brevity
const E = {
  ID: "id_government" as const,
  SELFIE: "id_selfie_match" as const,
  AUTHZ: "authority_letter" as const,
  EMAIL: "email_control" as const,
  OTP: "phone_otp" as const,
  LINKS: "links_screenshots" as const,
  COPYRIGHT: "copyright_proof" as const,
};
const W: ChannelHint = "webform";
const M: ChannelHint = "email";
const A: ChannelHint = "portal_api";

export const STARTER_50: TargetEntry[] = [
  // 1) Caller-ID / phone directories
  {
    key: "truecaller",
    name: "Truecaller",
    category: "caller_id",
    regions: ["IN", "GLOBAL"],
    preferredChannels: [W, M],
    typicalSLA_days: 7,
    evidence: [E.ID, E.EMAIL, E.AUTHZ],
    notes: "Unlist + spam-label corrections; phone-centric evidence.",
  },

  // 2) Big Social / UGC (2–10)
  { key: "instagram", name: "Instagram", category: "big_social", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS], notes: "Account/content takedowns; pair with search de-index." },
  { key: "facebook", name: "Facebook", category: "big_social", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "youtube", name: "YouTube", category: "big_social", regions: ["GLOBAL"], preferredChannels: [W, M, A], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS, E.COPYRIGHT], notes: "Copyright/privacy strike variants." },
  { key: "snapchat", name: "Snapchat", category: "big_social", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "x_twitter", name: "X (Twitter)", category: "big_social", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "reddit", name: "Reddit", category: "big_social", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "linkedin", name: "LinkedIn", category: "big_social", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL], notes: "Visibility + per-record corrections." },
  { key: "pinterest", name: "Pinterest", category: "big_social", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "quora", name: "Quora", category: "big_social", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL, E.LINKS] },

  // 3) India-first short-video & social (11–16)
  { key: "sharechat", name: "ShareChat", category: "india_short_video", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "moj", name: "Moj", category: "india_short_video", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "josh", name: "Josh", category: "india_short_video", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "roposo", name: "Roposo", category: "india_short_video", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "chingari", name: "Chingari", category: "india_short_video", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "mx_player", name: "MX Player (Communities)", category: "india_short_video", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },

  // 4) Messaging/community surfaces (17–18)
  { key: "telegram", name: "Telegram (public)", category: "messaging_public", regions: ["GLOBAL"], preferredChannels: [M, W], typicalSLA_days: 7, evidence: [E.LINKS, E.COPYRIGHT], notes: "Channel/post URLs, hashes, screenshots. Often evidence-heavy." },
  { key: "discord", name: "Discord (public servers)", category: "messaging_public", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 7, evidence: [E.LINKS] },

  // 5) Search layer (19–20)
  { key: "google_search", name: "Google Search (Outdated/Removal)", category: "search_index", regions: ["GLOBAL"], preferredChannels: [W], typicalSLA_days: 7, evidence: [E.LINKS], notes: "Pair with source takedown." },
  { key: "bing", name: "Bing (Content Removal)", category: "search_index", regions: ["GLOBAL"], preferredChannels: [W], typicalSLA_days: 7, evidence: [E.LINKS] },

  // 6) People-search / data brokers (21–30)
  { key: "zoominfo", name: "ZoomInfo", category: "people_search", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL, E.AUTHZ] },
  { key: "rocketreach", name: "RocketReach", category: "people_search", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL] },
  { key: "pipl", name: "Pipl", category: "people_search", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL] },
  { key: "radaris", name: "Radaris", category: "people_search", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL, E.AUTHZ] },
  { key: "whitepages", name: "Whitepages", category: "people_search", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL] },
  { key: "spokeo", name: "Spokeo", category: "people_search", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL] },
  { key: "beenverified", name: "BeenVerified", category: "people_search", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL] },
  { key: "peoplefinders", name: "PeopleFinders", category: "people_search", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL] },
  { key: "truthfinder", name: "TruthFinder", category: "people_search", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL] },
  { key: "intelius", name: "Intelius", category: "people_search", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL] },

  // 7) Creator discovery / influencer DBs (31–34)
  { key: "hypeauditor", name: "HypeAuditor", category: "creator_db", regions: ["GLOBAL"], preferredChannels: [M, W], typicalSLA_days: 30, evidence: [E.EMAIL, E.AUTHZ] },
  { key: "creatoriq", name: "CreatorIQ", category: "creator_db", regions: ["GLOBAL"], preferredChannels: [M], typicalSLA_days: 30, evidence: [E.EMAIL, E.AUTHZ] },
  { key: "grin", name: "Grin", category: "creator_db", regions: ["GLOBAL"], preferredChannels: [M], typicalSLA_days: 30, evidence: [E.EMAIL] },
  { key: "upfluence", name: "Upfluence", category: "creator_db", regions: ["GLOBAL"], preferredChannels: [M], typicalSLA_days: 30, evidence: [E.EMAIL] },

  // 8) Job & professional (35–39)
  { key: "naukri", name: "Naukri", category: "jobs_professional", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.AUTHZ] },
  { key: "linkedin_jobs", name: "LinkedIn (Jobs)", category: "jobs_professional", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL] },
  { key: "indeed", name: "Indeed", category: "jobs_professional", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL] },
  { key: "monster_india", name: "Monster India (Foundit)", category: "jobs_professional", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.AUTHZ] },
  { key: "glassdoor", name: "Glassdoor", category: "jobs_professional", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL, E.LINKS] },

  // 9) E-commerce & classifieds (40–43)
  { key: "amazon", name: "Amazon (Profile/Reviews)", category: "ecommerce_classifieds", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL, E.LINKS] },
  { key: "flipkart", name: "Flipkart (Reviews/Q&A)", category: "ecommerce_classifieds", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 30, evidence: [E.EMAIL, E.LINKS] },
  { key: "olx", name: "OLX", category: "ecommerce_classifieds", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "quikr", name: "Quikr", category: "ecommerce_classifieds", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },

  // 10) Dating & matrimonial (44–49)
  { key: "tinder", name: "Tinder", category: "dating_matrimony", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "bumble", name: "Bumble", category: "dating_matrimony", regions: ["GLOBAL"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "aisle", name: "Aisle", category: "dating_matrimony", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "shaadi", name: "Shaadi", category: "dating_matrimony", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "bharat_matrimony", name: "BharatMatrimony", category: "dating_matrimony", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },
  { key: "jeevansathi", name: "Jeevansathi", category: "dating_matrimony", regions: ["IN"], preferredChannels: [W, M], typicalSLA_days: 15, evidence: [E.EMAIL, E.LINKS] },

  // 11) Misc directories/adtech (50)
  { key: "adtech_local_vendors", name: "Local data/adtech vendors (IN)", category: "misc_adtech", regions: ["IN"], preferredChannels: [M, W], typicalSLA_days: 30, evidence: [E.AUTHZ, E.EMAIL], notes: "Case-by-case; verify presence & opt-out." },
];
