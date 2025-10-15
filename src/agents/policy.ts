// src/agents/policy.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDefaultControllerMeta } from "@/lib/controllers/meta";
import { loadControllerMeta } from "@/lib/controllers/store";

export type Channel = "email" | "webform" | "api";

export type ControllerPolicy = {
  controllerKey: string;
  preferredChannel: Channel;
  /** Channels we are allowed to use for this controller, in priority order */
  allowedChannels: Channel[];
  /** SLA targets consumed by Ops/SLA alerts */
  slas: { targetMin: number };
};

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
  };
}
