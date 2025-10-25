// src/agents/policy.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDefaultControllerMeta } from "@/lib/controllers/meta";
import { loadControllerMeta } from "@/lib/controllers/store";

export type Channel = "email" | "webform" | "api";

export type VerificationArtifacts = {
  htmlReport: boolean;
  screenshots: boolean;
  emailCopy: boolean;
  signedManifest: boolean;
};

export type ControllerPolicy = {
  controllerKey: string;
  preferredChannel: Channel;
  /** Channels we are allowed to use for this controller, in priority order */
  allowedChannels: Channel[];
  /** SLA targets consumed by Ops/SLA alerts */
  slas: { targetMin: number };
  /** What to include in verification/proof artifacts */
  verificationArtifacts: VerificationArtifacts;
  /** Identity / KYC expectations to surface in drafts */
  identity: { hints: string[] };
};

/** Per-controller artifact defaults (safe & rich by default) */
function artifactsFor(key: string): VerificationArtifacts {
  const k = (key || "").toLowerCase();
  switch (k) {
    case "truecaller":
      return { htmlReport: true, screenshots: true, emailCopy: false, signedManifest: true };
    case "naukri":
    case "foundit":
    case "shine":
    case "timesjobs":
      return { htmlReport: true, screenshots: false, emailCopy: true, signedManifest: true };
    case "olx":
      return { htmlReport: true, screenshots: true, emailCopy: false, signedManifest: true };
    default:
      return { htmlReport: true, screenshots: true, emailCopy: true, signedManifest: true };
  }
}

/** Build human-readable KYC/identity hints from meta.identity */
function identityHintsFor(
  key: string,
  meta?: { wantsName?: boolean; wantsEmail?: boolean; wantsPhone?: boolean; wantsIdDoc?: boolean },
): string[] {
  const k = (key || "").toLowerCase();
  const wantsName = meta?.wantsName ?? true;
  const wantsEmail = meta?.wantsEmail ?? true;
  const wantsPhone = meta?.wantsPhone ?? (k === "truecaller"); // likely for phone-centric controllers
  const wantsIdDoc = meta?.wantsIdDoc ?? false;

  const hints: string[] = [];
  if (wantsName) hints.push("full name");
  if (wantsEmail) hints.push("account email");
  if (wantsPhone) hints.push("phone number (last 4 or full)");
  if (wantsIdDoc) hints.push("identity proof (Govt-issued ID)");
  if (hints.length === 0) hints.push("basic identity");
  return hints;
}

/**
 * WORLD-CLASS: Async runtime policy that merges DB overrides
 * on top of sane code defaults. This is what the dispatcher should use.
 */
export async function getRuntimePolicy(controllerKey: string): Promise<ControllerPolicy> {
  const key = (controllerKey || "").toLowerCase();

  // Merge defaults + DB override (store.ts handles failures safely)
  const meta = (await loadControllerMeta(key)) ?? getDefaultControllerMeta(key);

  // Hard fallback so we never crash if a key isn’t in defaults
  const preferred: Channel = (meta?.preferred as Channel) || "email";
  const targetMin: number = typeof meta?.slaTargetMin === "number" ? meta!.slaTargetMin! : 180;

  // Allowed channel policy: keep conservative defaults
  const allowed: Channel[] = ["email", "webform"];
  if (preferred === "api") allowed.push("api");

  return {
    controllerKey: key,
    preferredChannel: preferred,
    allowedChannels: allowed,
    slas: { targetMin },
    verificationArtifacts: artifactsFor(key),
    identity: { hints: identityHintsFor(key, (meta as any)?.identity) },
  };
}

/**
 * Back-compat shim for any legacy imports that still call getControllerPolicy().
 * Returns **defaults only** (no DB). Prefer getRuntimePolicy() everywhere new.
 */
export function getControllerPolicy(controllerKey: string): ControllerPolicy {
  const key = (controllerKey || "").toLowerCase();
  const meta = getDefaultControllerMeta(key);
  const preferred: Channel = (meta?.preferred as Channel) || "email";
  const targetMin: number = typeof meta?.slaTargetMin === "number" ? meta!.slaTargetMin! : 180;

  const allowed: Channel[] = ["email", "webform"];
  if (preferred === "api") allowed.push("api");

  return {
    controllerKey: key,
    preferredChannel: preferred,
    allowedChannels: allowed,
    slas: { targetMin },
    verificationArtifacts: artifactsFor(key),
    identity: { hints: identityHintsFor(key, (meta as any)?.identity) },
  };
}

/**
 * Registry compatibility: some modules import `synthesizePolicyForController`
 * from "@/src/agents/policy". Export it as the async, DB-aware builder.
 */
export async function synthesizePolicyForController(controllerKey: string): Promise<ControllerPolicy> {
  return getRuntimePolicy(controllerKey);
}
