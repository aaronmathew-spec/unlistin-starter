// lib/controllers/meta.ts
export type PreferredChannel = "webform" | "email" | "api";

export type ControllerMeta = {
  key: string;                 // "truecaller"
  name: string;                // "Truecaller"
  preferred: PreferredChannel; // default channel
  formUrl?: string;            // known public webform (if stable)
  slaTargetMin?: number;       // target minutes for Phase 7/9 SLA/alerts
  identity?: {
    wantsName?: boolean;
    wantsEmail?: boolean;
    wantsPhone?: boolean;
    wantsIdDoc?: boolean;      // PAN/Aadhaar/passport style flows
  };
  locales?: Array<"en" | "hi">;
};

export const CONTROLLERS: Record<string, ControllerMeta> = {
  truecaller: {
    key: "truecaller",
    name: "Truecaller",
    preferred: "webform",
    formUrl: "https://www.truecaller.com/privacy-center/request/unlist",
    slaTargetMin: 60,
    identity: { wantsName: true, wantsEmail: true, wantsPhone: true },
    locales: ["en", "hi"],
  },
  naukri: {
    key: "naukri",
    name: "Naukri",
    preferred: "email",
    slaTargetMin: 180,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en", "hi"],
  },
  olx: {
    key: "olx",
    name: "OLX",
    preferred: "webform",
    slaTargetMin: 120,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en"],
  },
  foundit: {
    key: "foundit",
    name: "foundit",
    preferred: "email",
    slaTargetMin: 180,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en"],
  },
  shine: {
    key: "shine",
    name: "Shine",
    preferred: "email",
    slaTargetMin: 180,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en"],
  },
  timesjobs: {
    key: "timesjobs",
    name: "TimesJobs",
    preferred: "email",
    slaTargetMin: 180,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en"],
  },
};

// Safe read helper
export function getControllerMeta(key: string): ControllerMeta | null {
  const k = (key || "").toLowerCase();
  return CONTROLLERS[k] ?? null;
}
