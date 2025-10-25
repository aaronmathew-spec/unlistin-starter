// src/lib/targets/matrix.ts
import type { TargetEntry } from "./types";

export const runtime = "nodejs";

// Practical starter matrix (expand to 50+ progressively).
export const TARGET_MATRIX: TargetEntry[] = [
  // Caller-ID / phone directories
  {
    key: "truecaller",
    name: "Truecaller",
    category: "caller-id",
    preferredChannel: "webform",
    allowedChannels: ["webform", "email"],
    regions: ["IN", "GLOBAL"],
    requires: ["full-name", "phone", "urls-screenshots"],
    notes: "Unlisting + spam-label correction. Phone-centric identity.",
    help: {
      privacy: "https://www.truecaller.com/privacy-policy",
      removal: "https://www.truecaller.com/unlisting",
    },
  },

  // Big social / UGC
  {
    key: "instagram",
    name: "Instagram",
    category: "big-social",
    preferredChannel: "webform",
    allowedChannels: ["webform"],
    regions: ["GLOBAL"],
    requires: ["handle", "urls-screenshots"],
    notes: "Report impersonation/content via Help Center; privacy settings hardening.",
    help: { privacy: "https://help.instagram.com/" },
  },
  {
    key: "facebook",
    name: "Facebook",
    category: "big-social",
    preferredChannel: "webform",
    allowedChannels: ["webform"],
    regions: ["GLOBAL"],
    requires: ["handle", "urls-screenshots"],
    help: { privacy: "https://www.facebook.com/help/" },
  },
  {
    key: "youtube",
    name: "YouTube",
    category: "big-social",
    preferredChannel: "webform",
    allowedChannels: ["webform"],
    regions: ["GLOBAL"],
    requires: ["urls-screenshots"],
    notes: "Copyright/privacy takedowns by form; pair with search de-index.",
    help: { privacy: "https://support.google.com/youtube/topic/2803240" },
  },
  {
    key: "x",
    name: "X (Twitter)",
    category: "big-social",
    preferredChannel: "webform",
    allowedChannels: ["webform"],
    regions: ["GLOBAL"],
    requires: ["handle", "urls-screenshots"],
    help: { privacy: "https://help.twitter.com/en" },
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    category: "big-social",
    preferredChannel: "webform",
    allowedChannels: ["webform", "email"],
    regions: ["GLOBAL"],
    requires: ["account-email", "urls-screenshots"],
    notes: "Profile visibility controls + per-record removal.",
    help: { privacy: "https://www.linkedin.com/help/linkedin" },
  },

  // India-first short video & social (seed a few)
  {
    key: "sharechat",
    name: "ShareChat",
    category: "india-social",
    preferredChannel: "webform",
    allowedChannels: ["webform", "email"],
    regions: ["IN"],
    requires: ["handle", "urls-screenshots"],
  },
  {
    key: "moj",
    name: "Moj",
    category: "india-social",
    preferredChannel: "webform",
    allowedChannels: ["webform", "email"],
    regions: ["IN"],
    requires: ["handle", "urls-screenshots"],
  },

  // Messaging/community surfaces
  {
    key: "telegram",
    name: "Telegram",
    category: "messaging",
    preferredChannel: "webform",
    allowedChannels: ["webform", "email"],
    regions: ["GLOBAL"],
    requires: ["urls-screenshots"],
    notes: "Evidence-heavy; channel/admin contacts; hashes/links ideal.",
  },

  // Search layer
  {
    key: "google-search",
    name: "Google Search (Outdated Content / Removal)",
    category: "search-index",
    preferredChannel: "webform",
    allowedChannels: ["webform"],
    regions: ["GLOBAL"],
    requires: ["urls-screenshots"],
  },
  {
    key: "bing-search",
    name: "Bing (Webmaster Removal)",
    category: "search-index",
    preferredChannel: "webform",
    allowedChannels: ["webform"],
    regions: ["GLOBAL"],
    requires: ["urls-screenshots"],
  },

  // People-search / data-broker (a few exemplars; verify region acceptance)
  {
    key: "zoominfo",
    name: "ZoomInfo",
    category: "people-search",
    preferredChannel: "webform",
    allowedChannels: ["webform", "email"],
    regions: ["GLOBAL"],
    requires: ["full-name", "account-email", "urls-screenshots"],
  },
  {
    key: "rocketreach",
    name: "RocketReach",
    category: "people-search",
    preferredChannel: "webform",
    allowedChannels: ["webform", "email"],
    regions: ["GLOBAL"],
    requires: ["full-name", "account-email", "urls-screenshots"],
  },

  // Jobs & professional
  {
    key: "naukri",
    name: "Naukri",
    category: "jobs",
    preferredChannel: "email",
    allowedChannels: ["email", "webform"],
    regions: ["IN"],
    requires: ["account-email", "full-name", "urls-screenshots"],
  },
  {
    key: "foundit",
    name: "Foundit (Monster)",
    category: "jobs",
    preferredChannel: "email",
    allowedChannels: ["email", "webform"],
    regions: ["IN"],
    requires: ["account-email", "full-name"],
  },
  {
    key: "shine",
    name: "Shine",
    category: "jobs",
    preferredChannel: "email",
    allowedChannels: ["email", "webform"],
    regions: ["IN"],
    requires: ["account-email", "full-name"],
  },
  {
    key: "timesjobs",
    name: "TimesJobs",
    category: "jobs",
    preferredChannel: "email",
    allowedChannels: ["email", "webform"],
    regions: ["IN"],
    requires: ["account-email", "full-name"],
  },

  // Classifieds / commerce
  {
    key: "olx",
    name: "OLX",
    category: "classifieds",
    preferredChannel: "webform",
    allowedChannels: ["webform", "email"],
    regions: ["IN", "GLOBAL"],
    requires: ["urls-screenshots", "account-email"],
  },
  {
    key: "amazon",
    name: "Amazon (public profile/reviews)",
    category: "commerce",
    preferredChannel: "webform",
    allowedChannels: ["webform"],
    regions: ["GLOBAL"],
    requires: ["urls-screenshots", "account-email"],
  },

  // Dating (seed)
  {
    key: "tinder",
    name: "Tinder",
    category: "dating",
    preferredChannel: "webform",
    allowedChannels: ["webform", "email"],
    regions: ["GLOBAL"],
    requires: ["handle", "urls-screenshots"],
  },
];
