// src/lib/targets/matrix.ts
// Category-driven "Top 50" style target registry used by Ops UI / routing hints.
// Pure catalog content (NOT executable). Keeps separation from controllers/registry.

export const runtime = "nodejs";

export type TargetCategory =
  | "caller-id"
  | "big-social"
  | "india-social"
  | "messaging"
  | "search-layer"
  | "people-brokers"
  | "creator-db"
  | "jobs-pro"
  | "ecom-classifieds"
  | "dating-matrimony"
  | "misc-adtech";

export type TargetEntry = {
  key: string;                 // e.g. "truecaller", "instagram"
  displayName: string;         // Human name
  category: TargetCategory;
  controllerKey?: string;      // If wired to an internal controller
  prefersEmail?: boolean;
  hasWebform?: boolean;
  proofHints?: string[];       // Evidence typically required
  sla?: { ackDays?: number; resolveDays?: number; special24h?: boolean };
  urls?: { form?: string; policy?: string };
  notes?: string;
};

export type TargetMatrix = {
  version: string;
  entries: TargetEntry[];
};

export const TARGET_MATRIX: TargetMatrix = {
  version: "2025-10-25.v1",
  entries: [
    // Caller-ID / phone directories (high impact for spam/stalking)
    {
      key: "truecaller",
      displayName: "Truecaller",
      category: "caller-id",
      controllerKey: "truecaller",
      hasWebform: true,
      prefersEmail: false,
      proofHints: ["phone-last4", "screenshot of listing"],
      sla: { ackDays: 2, resolveDays: 7 },
      urls: { form: "https://www.truecaller.com/privacy-center/request/remove" },
    },

    // Big Social / UGC (subset; extend as needed)
    { key: "instagram", displayName: "Instagram", category: "big-social", proofHints: ["post URLs", "screenshots"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "facebook", displayName: "Facebook", category: "big-social", proofHints: ["post/profile URLs"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "youtube", displayName: "YouTube", category: "big-social", proofHints: ["video URLs", "timestamps"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "snapchat", displayName: "Snapchat", category: "big-social", proofHints: ["snap/story links"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "x", displayName: "X (Twitter)", category: "big-social", proofHints: ["tweet URLs"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "reddit", displayName: "Reddit", category: "big-social", proofHints: ["post/comment links"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "linkedin", displayName: "LinkedIn", category: "big-social", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "pinterest", displayName: "Pinterest", category: "big-social", proofHints: ["pin URLs"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "quora", displayName: "Quora", category: "big-social", proofHints: ["question/answer links"], sla: { ackDays: 7, resolveDays: 30 } },

    // India-first short video & social (subset)
    { key: "sharechat", displayName: "ShareChat", category: "india-social", proofHints: ["post links"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "moj", displayName: "Moj", category: "india-social", proofHints: ["post links"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "josh", displayName: "Josh", category: "india-social", proofHints: ["post links"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "roposo", displayName: "Roposo", category: "india-social", proofHints: ["post links"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "chingari", displayName: "Chingari", category: "india-social", proofHints: ["post links"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "mx", displayName: "MX Player Communities", category: "india-social", proofHints: ["post links"], sla: { ackDays: 7, resolveDays: 30 } },

    // Messaging/community (public surfaces)
    { key: "telegram", displayName: "Telegram (public)", category: "messaging", proofHints: ["channel/post links", "hashes"], sla: { ackDays: 2, resolveDays: 15 } },
    { key: "discord", displayName: "Discord (public)", category: "messaging", proofHints: ["server/channel links"], sla: { ackDays: 2, resolveDays: 15 } },

    // Search layer (index & cache)
    { key: "google-search", displayName: "Google Search Removal", category: "search-layer", proofHints: ["URL list", "cached vs live"], sla: { ackDays: 2, resolveDays: 14 } },
    { key: "bing-search", displayName: "Bing Removal", category: "search-layer", proofHints: ["URL list"], sla: { ackDays: 2, resolveDays: 14 } },

    // People-search / data brokers (subset)
    { key: "zoominfo", displayName: "ZoomInfo", category: "people-brokers", proofHints: ["profile link/screenshot"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "rocketreach", displayName: "RocketReach", category: "people-brokers", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "pipl", displayName: "Pipl", category: "people-brokers", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "radaris", displayName: "Radaris", category: "people-brokers", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "whitepages", displayName: "Whitepages", category: "people-brokers", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "spokeo", displayName: "Spokeo", category: "people-brokers", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "beenverified", displayName: "BeenVerified", category: "people-brokers", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },

    // Creator discovery / influencer DBs (subset)
    { key: "hypeauditor", displayName: "HypeAuditor", category: "creator-db", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "creatoriq", displayName: "CreatorIQ", category: "creator-db", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "grin", displayName: "Grin", category: "creator-db", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "upfluence", displayName: "Upfluence", category: "creator-db", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },

    // Jobs & professional (wired)
    {
      key: "naukri",
      displayName: "Naukri.com",
      category: "jobs-pro",
      controllerKey: "naukri",
      prefersEmail: true,
      proofHints: ["account email", "resume URL (if any)"],
      sla: { ackDays: 7, resolveDays: 30 },
    },
    {
      key: "foundit",
      displayName: "Foundit (Monster India)",
      category: "jobs-pro",
      controllerKey: "foundit",
      prefersEmail: true,
      proofHints: ["account email"],
      sla: { ackDays: 7, resolveDays: 30 },
    },
    {
      key: "shine",
      displayName: "Shine.com",
      category: "jobs-pro",
      controllerKey: "shine",
      prefersEmail: true,
      proofHints: ["account email"],
      sla: { ackDays: 7, resolveDays: 30 },
    },
    {
      key: "timesjobs",
      displayName: "TimesJobs",
      category: "jobs-pro",
      controllerKey: "timesjobs",
      prefersEmail: true,
      proofHints: ["account email"],
      sla: { ackDays: 7, resolveDays: 30 },
    },
    {
      key: "linkedin-jobs",
      displayName: "LinkedIn (visibility/data)",
      category: "jobs-pro",
      proofHints: ["profile link"],
      sla: { ackDays: 7, resolveDays: 30 },
    },
    {
      key: "olx",
      displayName: "OLX",
      category: "ecom-classifieds",
      controllerKey: "olx",
      hasWebform: true,
      proofHints: ["listing URLs"],
      sla: { ackDays: 2, resolveDays: 14 },
    },
    { key: "quikr", displayName: "Quikr", category: "ecom-classifieds", proofHints: ["listing URLs"], sla: { ackDays: 2, resolveDays: 14 } },

    // Dating & matrimonial (subset)
    { key: "tinder", displayName: "Tinder", category: "dating-matrimony", proofHints: ["profile screenshots"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "bumble", displayName: "Bumble", category: "dating-matrimony", proofHints: ["profile screenshots"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "aisle", displayName: "Aisle", category: "dating-matrimony", proofHints: ["profile screenshots"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "shaadi", displayName: "Shaadi", category: "dating-matrimony", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "bharatmatrimony", displayName: "BharatMatrimony", category: "dating-matrimony", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "jeevansathi", displayName: "Jeevansathi", category: "dating-matrimony", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },

    // Misc / adtech / lead vendors (placeholder; verify per client)
    { key: "local-lead-vendors", displayName: "Local consumer data vendors", category: "misc-adtech", notes: "Verify presence & opt-out per case", sla: { ackDays: 7, resolveDays: 30 } },
  ],
};
