// src/lib/targets/matrix.ts
// Category-driven target registry. Feed this to UI, dispatcher, and SLA logic.

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
  key: string;                 // e.g., "truecaller", "instagram"
  displayName: string;         // "Truecaller"
  category: TargetCategory;
  controllerKey?: string;      // if wired to a controller (naukri/olx/truecaller/etc.)
  hasWebform?: boolean;
  prefersEmail?: boolean;
  notes?: string;
  proofHints?: string[];       // evidence you usually need
  sla?: { ackDays?: number; resolveDays?: number; special24h?: boolean };
  urls?: { form?: string; policy?: string };
};

export type TargetMatrix = {
  version: string;
  entries: TargetEntry[];
};

export const TARGET_MATRIX: TargetMatrix = {
  version: "2025-10-25.v1",
  entries: [
    // Caller-ID / Phone directories
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

    // Big social / UGC (examples)
    { key: "instagram", displayName: "Instagram", category: "big-social", proofHints: ["post URLs", "screenshots"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "facebook", displayName: "Facebook", category: "big-social", proofHints: ["post/profile URLs"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "youtube", displayName: "YouTube", category: "big-social", proofHints: ["video URLs", "timestamps"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "x", displayName: "X (Twitter)", category: "big-social", proofHints: ["tweet URLs"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "reddit", displayName: "Reddit", category: "big-social", proofHints: ["post/comment links"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "linkedin", displayName: "LinkedIn", category: "big-social", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "pinterest", displayName: "Pinterest", category: "big-social", proofHints: ["pin URLs"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "quora", displayName: "Quora", category: "big-social", proofHints: ["question/answer links"], sla: { ackDays: 7, resolveDays: 30 } },

    // India-first short video & social (subset shown; add more as needed)
    { key: "sharechat", displayName: "ShareChat", category: "india-social", proofHints: ["post links"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "moj", displayName: "Moj", category: "india-social", proofHints: ["post links"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "josh", displayName: "Josh", category: "india-social", proofHints: ["post links"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "roposo", displayName: "Roposo", category: "india-social", proofHints: ["post links"], sla: { ackDays: 7, resolveDays: 30 } },

    // Messaging/community
    { key: "telegram", displayName: "Telegram (public)", category: "messaging", proofHints: ["channel/post links", "hashes"], sla: { ackDays: 2, resolveDays: 15 } },
    { key: "discord", displayName: "Discord (public)", category: "messaging", proofHints: ["server/channel links"], sla: { ackDays: 2, resolveDays: 15 } },

    // Search-layer
    { key: "google-search", displayName: "Google Search Removal", category: "search-layer", proofHints: ["URL list", "cached vs live"], sla: { ackDays: 2, resolveDays: 14 } },
    { key: "bing-search", displayName: "Bing Removal", category: "search-layer", proofHints: ["URL list"], sla: { ackDays: 2, resolveDays: 14 } },

    // People-search / brokers (subset)
    { key: "zoominfo", displayName: "ZoomInfo", category: "people-brokers", proofHints: ["profile link/screenshot"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "rocketreach", displayName: "RocketReach", category: "people-brokers", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "radaris", displayName: "Radaris", category: "people-brokers", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },

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
      key: "olx",
      displayName: "OLX",
      category: "ecom-classifieds",
      controllerKey: "olx",
      hasWebform: true,
      proofHints: ["listing URLs"],
      sla: { ackDays: 2, resolveDays: 14 },
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

    // Dating & matrimonial (subset)
    { key: "tinder", displayName: "Tinder", category: "dating-matrimony", proofHints: ["profile screenshots"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "bumble", displayName: "Bumble", category: "dating-matrimony", proofHints: ["profile screenshots"], sla: { ackDays: 7, resolveDays: 30 } },
    { key: "shaadi", displayName: "Shaadi", category: "dating-matrimony", proofHints: ["profile link"], sla: { ackDays: 7, resolveDays: 30 } },
  ],
};
