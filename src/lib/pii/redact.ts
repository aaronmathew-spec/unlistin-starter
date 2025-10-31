/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Small PII masking helpers + deep redactor for log-safety.
 * - No throws on weird inputs
 * - Works with strict TS (no possibly-undefined index access)
 * - Keeps shapes intact for easier debugging
 */

function maskMiddle(input: string, keepStart = 1, keepEnd = 1, maskChar = "•"): string {
  const s = String(input ?? "");
  if (s.length === 0) return "";
  const start = s.slice(0, Math.max(0, keepStart));
  const end = s.slice(Math.max(0, s.length - keepEnd));
  const midLen = Math.max(0, s.length - start.length - end.length);
  return start + (midLen > 0 ? maskChar.repeat(midLen) : "") + end;
}

export function maskEmail(v: unknown): string {
  const s = String(v ?? "");
  if (!s) return "";
  const parts = s.split("@");
  const user = parts[0] ?? "";
  const domain = parts[1];

  // If domain missing, treat as a plain handle/username
  if (!domain) return maskMiddle(user, 0, Math.min(2, user.length));

  // Email: keep first char of user if present, mask the rest of user
  const userMasked = user.length > 0 ? `${user[0]}${"•".repeat(Math.max(0, user.length - 1))}` : "•";
  return `${userMasked}@${domain}`;
}

export function maskPhone(v: unknown): string {
  const s = String(v ?? "");
  if (!s) return "";

  // Keep "+" and the last 2 digits; mask other digits.
  // Non-digits (spaces, dashes) are preserved for readability.
  const digits = s.replace(/\D/g, "");
  if (digits.length === 0) return s;

  let remainingDigits = digits.length;
  let masked = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (/\d/.test(ch)) {
      // show last 2 digits, mask the rest
      const show = remainingDigits <= 2;
      masked += show ? ch : "•";
      remainingDigits--;
    } else {
      masked += ch;
    }
  }
  return masked;
}

function looksLikeEmailKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k === "email" ||
    k.endsWith("_email") ||
    k.includes("email")
  );
}

function looksLikePhoneKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k === "phone" ||
    k.endsWith("_phone") ||
    k.includes("mobile") ||
    k.includes("tel") ||
    k.includes("contact_number")
  );
}

function maskByKey(key: string, value: any): any {
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    const v = String(value);
    if (looksLikeEmailKey(key)) return maskEmail(v);
    if (looksLikePhoneKey(key)) return maskPhone(v);
    return value;
  }
  return value;
}

type RedactOptions = {
  /** Explicit keys to mask as opaque strings (in addition to auto email/phone detection) */
  keys?: string[];
  /** Max depth to traverse; prevents runaway recursion (default 6) */
  maxDepth?: number;
};

/**
 * Redact PII-like fields from an object for logging.
 * - Masks fields that look like email/phone automatically
 * - Also masks any explicit keys provided in opts.keys
 * - Safe on arrays, objects, primitives; preserves shape
 */
export function redactForLogs<T>(input: T, opts?: RedactOptions): T {
  const keys = (opts?.keys ?? []).map((k) => k.toLowerCase());
  const maxDepth = Number.isFinite(opts?.maxDepth) ? Math.max(0, Number(opts?.maxDepth)) : 6;

  const seen = new WeakSet<object>();

  function redact(value: any, depth: number, parentKey?: string): any {
    if (depth > maxDepth) return typeof value === "object" ? "[…]" : value;

    // primitives
    if (value === null || value === undefined) return value;
    const t = typeof value;
    if (t === "string" || t === "number" || t === "boolean" || t === "bigint") {
      if (parentKey) return maskByKey(parentKey, value);
      return value;
    }

    // functions / symbols: leave as-is
    if (t === "function" || t === "symbol") return String(value);

    // Dates
    if (value instanceof Date) return value.toISOString();

    // Arrays
    if (Array.isArray(value)) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
      return value.map((v) => redact(v, depth + 1, parentKey));
    }

    // Objects
    if (t === "object") {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);

      const out: Record<string, any> = {};
      for (const k of Object.keys(value)) {
        const v = (value as any)[k];
        const lowerK = k.toLowerCase();

        // explicit keys take precedence
        if (keys.includes(lowerK)) {
          if (looksLikeEmailKey(lowerK)) {
            out[k] = maskEmail(v);
          } else if (looksLikePhoneKey(lowerK)) {
            out[k] = maskPhone(v);
          } else if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") {
            out[k] = maskMiddle(String(v), 0, 0); // fully mask opaque keys
          } else {
            out[k] = "[redacted]";
          }
          continue;
        }

        // auto email/phone detection
        if (looksLikeEmailKey(lowerK)) {
          out[k] = maskEmail(v);
        } else if (looksLikePhoneKey(lowerK)) {
          out[k] = maskPhone(v);
        } else {
          out[k] = redact(v, depth + 1, k);
        }
      }
      return out;
    }

    // Fallback
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }

  return redact(input, 0) as T;
}
