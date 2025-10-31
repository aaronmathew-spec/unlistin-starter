// src/lib/pii/redact.ts

type RedactOpts = { keys?: string[] };
const DEFAULT_KEYS = ["email", "phone", "token", "authorization", "password"];

function maskEmail(v: string) {
  const [u, d] = v.split("@");
  if (!d) return v.replace(/.(?=.{2})/g, "•");
  return `${u[0] ?? ""}•••@${d}`;
}

function maskPhone(v: string) {
  return v.replace(/\d(?=\d{2})/g, "•");
}

function scrubValue(val: unknown, key?: string) {
  if (typeof val !== "string") return val;

  if (key === "email") return maskEmail(val);
  if (key === "phone") return maskPhone(val);

  // Heuristic scrubs
  if (val.includes("@")) return maskEmail(val);
  if (/^\+?\d{7,}$/.test(val)) return maskPhone(val);
  return val;
}

export function redactForLogs<T>(obj: T, opts?: RedactOpts): T {
  const KEYS = new Set([...(opts?.keys ?? []), ...DEFAULT_KEYS]);
  try {
    const walk = (v: any, k?: string): any => {
      if (v == null) return v;
      if (typeof v === "string") return scrubValue(v, k);
      if (Array.isArray(v)) return v.map((x) => walk(x, k));
      if (typeof v === "object") {
        const out: any = Array.isArray(v) ? [] : {};
        for (const [kk, vv] of Object.entries(v)) {
          out[kk] = KEYS.has(kk) ? "•••" : walk(vv, kk);
        }
        return out;
      }
      return v;
    };
    return walk(obj) as T;
  } catch {
    return obj;
  }
}
