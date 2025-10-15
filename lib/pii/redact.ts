// lib/pii/redact.ts
/**
 * Minimal PII redaction for safe logs/artifacts.
 * - Email -> mask local-part middle (keep first & last char) + keep domain
 * - Phone -> mask all but last 4 digits
 * - Free text -> naive masking for any embedded email/phone
 *
 * NOTE: This is for LOGS and debug artifacts — not for data-at-rest.
 */

const EMAIL_RE =
  /([a-zA-Z0-9._%+-])([a-zA-Z0-9._%+-]*)([a-zA-Z0-9._%+-])@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

const PHONE_RE =
  /\b(?:\+?\d{1,3}[\s\-\.]?)?(?:\(?\d{2,4}\)?[\s\-\.]?)?\d{2,4}[\s\-\.]?\d{3,4}\b/g;

export function maskEmail(input: string): string {
  return input.replace(EMAIL_RE, (_m, a, mid, b, domain) => {
    const middle = mid && String(mid).length > 0 ? "…" : "";
    return `${a}${middle}${b}@${domain}`;
  });
}

export function maskPhone(input: string): string {
  return input.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 6) return "xx"; // too short -> fully mask
    return `xxxxxx${digits.slice(-4)}`;
  });
}

export function maskFreeText(input: string): string {
  // Order: email first, then phone
  return maskPhone(maskEmail(input));
}

type RedactOptions = {
  /** specific object keys that should always be masked if string-like */
  keys?: string[];
};

/**
 * Redacts common fields in an object for log safety.
 * - Masks emails/phones anywhere in string values
 * - If `keys` provided, those keys are masked even if no email/phone detected
 */
export function redactForLogs<T>(obj: T, opts: RedactOptions = {}): T {
  const targetKeys = new Set((opts.keys || []).map((k) => k.toLowerCase()));

  const json = JSON.stringify(obj, (_k, v) => {
    if (v == null) return v;

    if (typeof v === "string") {
      return maskFreeText(v);
    }

    if (typeof v === "object") {
      return v;
    }

    return v;
  });

  const revived: any = JSON.parse(json);

  function maskByKey(o: any) {
    if (!o || typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v == null) continue;
      if (typeof v === "string" && targetKeys.has(k.toLowerCase())) {
        o[k] = "«redacted»";
      } else if (typeof v === "object") {
        maskByKey(v);
      }
    }
  }
  if (targetKeys.size) maskByKey(revived);

  return revived as T;
}
