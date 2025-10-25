// src/lib/controllers/dispatch.ts
export const runtime = "nodejs";

import type { ControllerKey } from "@/src/lib/controllers/registry";
import { choosePrimaryChannel } from "@/src/lib/controllers/registry";

// Existing controller templates
import { buildTruecallerRemovalEmail } from "@/src/lib/email/templates/controllers/truecaller";
import { buildNaukriRemovalEmail } from "@/src/lib/email/templates/controllers/naukri";
import { buildOlxRemovalEmail } from "@/src/lib/email/templates/controllers/olx";

// NEW templates
import { buildFounditRemovalEmail } from "@/src/lib/email/templates/controllers/foundit";
import { buildShineRemovalEmail } from "@/src/lib/email/templates/controllers/shine";
import { buildTimesJobsRemovalEmail } from "@/src/lib/email/templates/controllers/timesjobs";

// Webform arg types (existing)
import type { WebformArgs as TruecallerArgs } from "@/src/lib/controllers/webforms/truecaller";
import type { WebformArgs as NaukriArgs } from "@/src/lib/controllers/webforms/naukri";
import type { WebformArgs as OlxArgs } from "@/src/lib/controllers/webforms/olx";

// Jurisdiction normalization
import { resolveLawKeyFromRegion } from "@/src/lib/compliance/dsr";

export type RegionKey = string;

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
  body: string;
};

export type WebformPayload =
  | { channel: "webform"; controller: "truecaller"; args: TruecallerArgs }
  | { channel: "webform"; controller: "naukri"; args: NaukriArgs }
  | { channel: "webform"; controller: "olx"; args: OlxArgs };

export type BuiltDispatch = EmailPayload | WebformPayload;

export function asControllerKey(x: string): ControllerKey {
  const v = x as ControllerKey;
  if (
    v === "truecaller" ||
    v === "naukri" ||
    v === "olx" ||
    v === "foundit" ||
    v === "shine" ||
    v === "timesjobs"
  ) {
    return v;
  }
  throw new Error(`Unknown controller: ${x}`);
}

export async function buildDispatchForController(input: DispatchInput): Promise<BuiltDispatch> {
  const key = asControllerKey(input.controller);
  const chosen = await choosePrimaryChannel(key);
  const lawKey = resolveLawKeyFromRegion(input.region);

  // EMAIL path
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
      case "foundit": {
        const { subject, body } = buildFounditRemovalEmail({
          region: lawKey,
          subjectFullName: input.subjectFullName,
          subjectEmail: input.subjectEmail,
          identifiers: input.identifiers,
        });
        return { channel: "email", subject, body };
      }
      case "shine": {
        const { subject, body } = buildShineRemovalEmail({
          region: lawKey,
          subjectFullName: input.subjectFullName,
          subjectEmail: input.subjectEmail,
          identifiers: input.identifiers,
        });
        return { channel: "email", subject, body };
      }
      case "timesjobs": {
        const { subject, body } = buildTimesJobsRemovalEmail({
          region: lawKey,
          subjectFullName: input.subjectFullName,
          subjectEmail: input.subjectEmail,
          identifiers: input.identifiers,
        });
        return { channel: "email", subject, body };
      }
    }
  }

  // WEBFORM path (for controllers that have webforms)
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
    // foundit/shine/timesjobs are email-first; no webform fallback for now.
    default:
      // For unknown webform path on email-first controllers, fall back to email build above,
      // but since chosen !== "email" here, treat as unsupported for webform.
      throw new Error(`Unsupported controller for webform: ${key as never}`);
  }
}
