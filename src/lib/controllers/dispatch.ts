// src/lib/controllers/dispatch.ts
/* Policy-aware dispatch builder (non-breaking).
   Chooses channel using the Controller Registry and returns a ready payload.
   The caller (dispatcher / worker) can execute email or webform accordingly.
*/

export const runtime = "nodejs";

import type { ControllerKey } from "@/src/lib/controllers/registry";
import { choosePrimaryChannel } from "@/src/lib/controllers/registry";

// Controller email templates
import { buildTruecallerRemovalEmail } from "@/src/lib/email/templates/controllers/truecaller";
import { buildNaukriRemovalEmail } from "@/src/lib/email/templates/controllers/naukri";
import { buildOlxRemovalEmail } from "@/src/lib/email/templates/controllers/olx";

// Webform shims (Playwright workers will import/execute these separately)
import type { WebformArgs as TruecallerArgs } from "@/src/lib/controllers/webforms/truecaller";
import type { WebformArgs as NaukriArgs } from "@/src/lib/controllers/webforms/naukri";
import type { WebformArgs as OlxArgs } from "@/src/lib/controllers/webforms/olx";

// NEW: jurisdiction normalization
import { resolveLawKeyFromRegion } from "@/src/lib/compliance/dsr";

export type RegionKey = string; // e.g., "IN", "EU", "US-CA", or canonical "DPDP_IN" etc.

export type DispatchInput = {
  controller: ControllerKey;
  region: RegionKey;
  subjectFullName?: string;
  subjectEmail?: string;
  subjectPhone?: string;
  identifiers?: Record<string, string | undefined>;
};

export type EmailPayload = {
  channel: "email";
  subject: string;
  body: string; // plain text
};

export type WebformPayload =
  | { channel: "webform"; controller: "truecaller"; args: TruecallerArgs }
  | { channel: "webform"; controller: "naukri"; args: NaukriArgs }
  | { channel: "webform"; controller: "olx"; args: OlxArgs };

export type BuiltDispatch = EmailPayload | WebformPayload;

/** Narrow unknown string to ControllerKey safely (throw on unexpected) */
export function asControllerKey(x: string): ControllerKey {
  const v = x as ControllerKey;
  if (v === "truecaller" || v === "naukri" || v === "olx") return v;
  throw new Error(`Unknown controller: ${x}`);
}

/**
 * Build a concrete, channel-specific dispatch payload using registry policy.
 * This does not send anything; it only returns what should be sent.
 */
export async function buildDispatchForController(input: DispatchInput): Promise<BuiltDispatch> {
  const key = asControllerKey(input.controller);
  const chosen = await choosePrimaryChannel(key);

  // NEW: normalize region into a canonical LawKey (DPDP_IN/GDPR_EU/CCPA_US_CA)
  const lawKey = resolveLawKeyFromRegion(input.region);

  // Email path
  if (chosen === "email") {
    switch (key) {
      case "truecaller": {
        const { subject, body } = buildTruecallerRemovalEmail({
          region: lawKey,
          subjectFullName: input.subjectFullName,
          subjectEmail: input.subjectEmail,
          subjectPhone: input.subjectPhone,
          identifiers: input.identifiers,
        });
        return { channel: "email", subject, body };
      }
      case "naukri": {
        const { subject, body } = buildNaukriRemovalEmail({
          region: lawKey,
          subjectFullName: input.subjectFullName,
          subjectEmail: input.subjectEmail,
          identifiers: input.identifiers,
        });
        return { channel: "email", subject, body };
      }
      case "olx": {
        const { subject, body } = buildOlxRemovalEmail({
          region: lawKey,
          subjectFullName: input.subjectFullName,
          subjectEmail: input.subjectEmail,
          identifiers: input.identifiers,
        });
        return { channel: "email", subject, body };
      }
    }
  }

  // Webform path (fallback or policy-preferred)
  switch (key) {
    case "truecaller":
      return {
        channel: "webform",
        controller: "truecaller",
        args: {
          subjectFullName: input.subjectFullName,
          subjectEmail: input.subjectEmail,
          subjectPhone: input.subjectPhone,
          identifiers: input.identifiers,
          reason: "Right to erasure request",
        },
      };
    case "naukri":
      return {
        channel: "webform",
        controller: "naukri",
        args: {
          subjectFullName: input.subjectFullName,
          subjectEmail: input.subjectEmail,
          identifiers: input.identifiers,
        },
      };
    case "olx":
      return {
        channel: "webform",
        controller: "olx",
        args: {
          subjectFullName: input.subjectFullName,
          subjectEmail: input.subjectEmail,
          identifiers: input.identifiers,
        },
      };
    default:
      throw new Error(`Unsupported controller for webform: ${key satisfies never}`);
  }
}
