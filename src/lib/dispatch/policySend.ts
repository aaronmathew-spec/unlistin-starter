// src/lib/dispatch/policySend.ts
// Policy-aware dispatcher (additive). Keeps your legacy dispatcher untouched.
// Exports a named and default `sendControllerRequest` for easy adoption.

export const runtime = "nodejs";

import type { ControllerKey } from "@/src/lib/controllers/registry";
import {
  asControllerKey,
  buildDispatchForController,
  type DispatchInput,
  type BuiltDispatch,
} from "@/src/lib/controllers/dispatch";
import { executeBuiltDispatch, type ExecuteResult } from "@/src/lib/dispatch/execute";

export type SendControllerInput = DispatchInput & {
  /** Optional override for email destination */
  to?: string | string[];
  /** Optional override for email sender */
  from?: string;
};

export type SendControllerResult = ExecuteResult & {
  built: BuiltDispatch;
};

export async function sendControllerRequest(input: SendControllerInput): Promise<SendControllerResult> {
  const controller: ControllerKey = asControllerKey(input.controller);
  const built = await buildDispatchForController({
    controller,
    region: input.region,
    subjectFullName: input.subjectFullName,
    subjectEmail: input.subjectEmail,
    subjectPhone: input.subjectPhone,
    identifiers: input.identifiers,
  });

  const executed = await executeBuiltDispatch(built, { to: input.to, from: input.from, controller });

  return Object.assign({ built }, executed);
}

// Default export for convenience
export default sendControllerRequest;
