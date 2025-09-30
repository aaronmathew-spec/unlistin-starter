export type LogFields = Record<string, unknown>;

function kv(fields?: LogFields) {
  try {
    return fields ? " " + JSON.stringify(fields) : "";
  } catch {
    return "";
  }
}

export const logger = {
  info: (msg: string, fields?: LogFields) => console.log(`[INFO] ${msg}${kv(fields)}`),
  warn: (msg: string, fields?: LogFields) => console.warn(`[WARN] ${msg}${kv(fields)}`),
  error: (msg: string, fields?: LogFields) => console.error(`[ERROR] ${msg}${kv(fields)}`),
};
