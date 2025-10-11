import fs from "node:fs";
import path from "node:path";

export type Playbook = {
  site_id: string;
  intents: string[];
  channels: ("email" | "webform" | "portal")[];
  email?: {
    to: string[];
    cc?: string[];
    subject: string;
    body: string[]; // joined with \n
  };
  required_fields?: string[];
  evidence_rules?: {
    store_message_id?: boolean;
  };
};

export function loadPlaybook(siteId: string): Playbook | null {
  const p = path.join(process.cwd(), "site_playbooks", `${siteId}.json`);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw) as Playbook;
}

export function template(str: string, vars: Record<string, string>) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? "").toString());
}

export function renderBody(lines: string[], vars: Record<string, string>) {
  return lines.map((l) => template(l, vars)).join("\n");
}
