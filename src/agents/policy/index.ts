// src/agents/policy/index.ts
import { getIndiaPolicy, type ControllerPolicy } from "./india";

/**
 * Main entry for policy lookup. If you expand beyond India,
 * add geo inference + controller mapping here.
 */
export function getControllerPolicy(controllerKey: string, countryHint?: string): ControllerPolicy {
  // For now, everything in this pack is India-focused.
  return getIndiaPolicy(controllerKey);
}

export type { ControllerPolicy } from "./india";
