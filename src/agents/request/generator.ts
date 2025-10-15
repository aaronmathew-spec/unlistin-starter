// src/agents/request/generator.ts
/**
 * Request draft generator that merges:
 * - site-specific policy (identity/SLA channels)
 * - site-specific templates (EN/HI)
 *
 * Output is ready for your dispatch engine to send or enqueue as form jobs.
 */
import { getControllerPolicy, type ControllerPolicy } from "@/src/agents/policy";
import {
  renderSiteSpecificEmail,
  type SubjectProfile,
} from "@/src/agents/request/templates";
import { redactForLogs } from "@/lib/pii/redact";

export type Locale = "en" | "hi";
export type SiteKey =
  | "truecaller"
  | "naukri"
  | "olx"
  | "foundit"
  | "shine"
  | "timesjobs"
  | "generic";

export type DraftRequest = {
  controllerKey: SiteKey;
  controllerName: string;
  locale: Locale;
  subject: string;
  bodyText: string;             // plaintext body
  preferredChannel: ControllerPolicy["preferredChannel"];
  allowedChannels: ControllerPolicy["allowedChannels"];
  kycHints: string[];
  slas: ControllerPolicy["slas"];
  artifacts: ControllerPolicy["verificationArtifacts"];
};

export function generateDraft(
  controllerKey: SiteKey,
  controllerName: string,
  subjectProfile: SubjectProfile,
  locale: Locale = "en"
): DraftRequest {
  const policy = getControllerPolicy(controllerKey);
  const t = renderSiteSpecificEmail(controllerKey, controllerName, subjectProfile, locale);

  // The template renders plain text; you may add HTML variant upstream if needed
  const bodyText = [
    t.body,
    "",
    // Policy footer (tiny, helpful)
    locale === "hi"
      ? `नोट: सत्यापन हेतु: ${policy.identity.hints.join(" | ")}`
      : `Note on verification: ${policy.identity.hints.join(" | ")}`,
  ].join("\n");

  // Safe log example (callers decide whether/where to log)
  // eslint-disable-next-line no-console
  console.debug(
    "[draft.generate]",
    redactForLogs({ controllerKey, controllerName, locale, subjectProfile, policy })
  );

  return {
    controllerKey,
    controllerName,
    locale,
    subject: t.subject,
    bodyText,
    preferredChannel: policy.preferredChannel,
    allowedChannels: policy.allowedChannels,
    kycHints: policy.identity.hints,
    slas: policy.slas,
    artifacts: policy.verificationArtifacts,
  };
}
