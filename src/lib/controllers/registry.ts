// src/lib/controllers/registry.ts
/* Controller Registry: central policy, rate limits, channel prefs, and contacts.
   Non-breaking: pure exports. Dispatcher can opt-in to use these helpers. */

import type { ControllerPolicy } from "@/src/agents/policy";
import { synthesizePolicyForController } from "@/src/agents/policy";

export type ControllerKey = "truecaller" | "naukri" | "olx" | "foundit" | "shine" | "timesjobs";

// Basic rate/concurrency policy used by ops/dispatcher.
export type RatePolicy = {
  rps: number;
  burst: number;
  concurrency: number;
  retryBackoffMs: number[];
};

// Quirks can drive worker behavior (timeouts, captcha, etc.)
export type ControllerQuirks = {
  prefersHumanName?: boolean;
  hasCaptcha?: boolean;
  slowForm?: boolean;
  localeHints?: string[];
};

// Channel preference from registry (policy determines final at runtime).
export type ChannelPref = {
  emailEnabled: boolean;
  webformEnabled: boolean;
  apiEnabled: boolean;
};

// Optional contact directory for email channel + form URL for Ops
export type Contacts = {
  emails?: string[];
  formUrl?: string;
};

export type ControllerEntry = {
  key: ControllerKey;
  displayName: string;
  rate: RatePolicy;
  channels: ChannelPref;
  quirks: ControllerQuirks;
  contacts?: Contacts;
  defaultPolicy?: Partial<ControllerPolicy>;
};

const DEFAULT_BACKOFF = [2000, 5000, 15000, 60000];

const REGISTRY: Record<ControllerKey, ControllerEntry> = {
  truecaller: {
    key: "truecaller",
    displayName: "Truecaller",
    rate: { rps: 0.2, burst: 1, concurrency: 1, retryBackoffMs: DEFAULT_BACKOFF },
    channels: { emailEnabled: false, webformEnabled: true, apiEnabled: false },
    quirks: { prefersHumanName: true, hasCaptcha: true, slowForm: true, localeHints: ["en"] },
    contacts: { formUrl: "https://www.truecaller.com/privacy-center/request/remove" },
    defaultPolicy: { slas: { targetMin: 180 } },
  },
  naukri: {
    key: "naukri",
    displayName: "Naukri.com",
    rate: { rps: 0.5, burst: 2, concurrency: 2, retryBackoffMs: DEFAULT_BACKOFF },
    channels: { emailEnabled: true, webformEnabled: false, apiEnabled: false },
    quirks: { prefersHumanName: true, localeHints: ["en"] },
    contacts: { /* emails: ["privacy@naukri.com"] */ },
    defaultPolicy: { slas: { targetMin: 180 } },
  },
  olx: {
    key: "olx",
    displayName: "OLX",
    rate: { rps: 0.3, burst: 1, concurrency: 1, retryBackoffMs: DEFAULT_BACKOFF },
    channels: { emailEnabled: false, webformEnabled: true, apiEnabled: false },
    quirks: { hasCaptcha: true, slowForm: true, localeHints: ["en"] },
    contacts: { formUrl: "https://help.olx.com/hc/requests/new" },
    defaultPolicy: { slas: { targetMin: 180 } },
  },
  foundit: {
    key: "foundit",
    displayName: "Foundit (Monster India)",
    rate: { rps: 0.5, burst: 2, concurrency: 2, retryBackoffMs: DEFAULT_BACKOFF },
    channels: { emailEnabled: true, webformEnabled: false, apiEnabled: false },
    quirks: { prefersHumanName: true, localeHints: ["en"] },
    contacts: { /* emails: ["privacy@foundit.in"] */ },
    defaultPolicy: { slas: { targetMin: 180 } },
  },
  shine: {
    key: "shine",
    displayName: "Shine.com",
    rate: { rps: 0.5, burst: 2, concurrency: 2, retryBackoffMs: DEFAULT_BACKOFF },
    channels: { emailEnabled: true, webformEnabled: false, apiEnabled: false },
    quirks: { prefersHumanName: true, localeHints: ["en"] },
    contacts: { /* emails: ["privacy@shine.com"] */ },
    defaultPolicy: { slas: { targetMin: 180 } },
  },
  timesjobs: {
    key: "timesjobs",
    displayName: "TimesJobs",
    rate: { rps: 0.5, burst: 2, concurrency: 2, retryBackoffMs: DEFAULT_BACKOFF },
    channels: { emailEnabled: true, webformEnabled: false, apiEnabled: false },
    quirks: { prefersHumanName: true, localeHints: ["en"] },
    contacts: { /* emails: ["privacy@timesjobs.com"] */ },
    defaultPolicy: { slas: { targetMin: 180 } },
  },
};

export function listControllers(): ControllerEntry[] {
  return Object.values(REGISTRY);
}

export function getControllerEntry(key: ControllerKey): ControllerEntry {
  return REGISTRY[key];
}

import type { ControllerPolicy } from "@/src/agents/policy";
export async function getControllerPolicy(key: ControllerKey): Promise<ControllerPolicy | null> {
  return synthesizePolicyForController(key);
}

export async function choosePrimaryChannel(key: ControllerKey): Promise<"email" | "webform" | "api"> {
  const entry = getControllerEntry(key);
  const policy = await getControllerPolicy(key);
  const policyPreferred = policy?.preferredChannel;
  const enabled = [
    entry.channels.emailEnabled ? "email" : null,
    entry.channels.webformEnabled ? "webform" : null,
    entry.channels.apiEnabled ? "api" : null,
  ].filter(Boolean) as Array<"email" | "webform" | "api">;

  if (policyPreferred && enabled.includes(policyPreferred)) return policyPreferred;
  return enabled[0] ?? "webform";
}
