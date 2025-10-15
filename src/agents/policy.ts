// src/agents/policy.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDefaultControllerMeta } from "@/lib/controllers/meta";
import { loadControllerMeta } from "@/lib/controllers/store";

export type Channel = "email" | "webform" | "api";

export type VerificationArtifacts = {
  /** Include rendered HTML report (normalized evidence + result) */
  htmlReport: boolean;
  /** Capture screenshots from webform/verification steps */
  screenshots: boolean;
  /** Store a copy of the outbound email (text/html) in artifacts */
  emailCopy: boolean;
  /** Produce signed manifest + Merkle proof in the Proof Pack */
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
      // Conservative rich defaults
      return { htmlReport: true, screenshots: true, emailCopy: true, signedManifest: true };
  }
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
  };
}
