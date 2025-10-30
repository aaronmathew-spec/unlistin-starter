export const runtime = "nodejs";

/**
 * POST /api/targets/plan
 * Accepts flexible input:
 *  - { subject?: string, fullName?: string, region?: string, categories?: string[], channels?: Channel[] }
 * Returns:
 *  - { ok: true, region: string|null, total: number, plan: PlanItem[] }
 * The PlanItem shape matches /ops/targets/run expectations.
 */

type Channel = "email" | "webform" | "portal" | "letter" | "fax";
type PlanItem = {
  key: string;
  name: string;
  category?: string | null;
  preferredChannel?: Channel | null;
  allowedChannels?: Channel[] | null;
  requires?: string[] | null;
  notes?: string | null;
  // Internal only, stripped before returning
  _score?: number;
};

type PlanInput = {
  subject?: string | null;
  fullName?: string | null; // tolerated alias
  region?: string | null;
  categories?: string[] | null;
  channels?: Channel[] | null;
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

/** Minimal controller matrix. Extend freely; keep keys stable for idempotency. */
const CONTROLLERS: Array<
  Omit<PlanItem, "allowedChannels" | "_score"> & {
    defaultAllowed: Channel[];
    priority: number; // lower is more important before weighting
    regions?: string[]; // if present, restrict visibility
  }
> = [
  {
    key: "google",
    name: "Google (Search/Maps/Profiles)",
    category: "Core Web",
    preferredChannel: "webform",
    defaultAllowed: ["webform", "email"],
    priority: 1,
    notes: "Right to erasure / de-index; profile image takedowns supported by policy.",
  },
  {
    key: "facebook",
    name: "Meta (Facebook/Instagram)",
    category: "Social",
    preferredChannel: "webform",
    defaultAllowed: ["webform"],
    priority: 2,
    notes: "Impersonation and privacy violations can be escalated.",
  },
  {
    key: "x",
    name: "X (Twitter)",
    category: "Social",
    preferredChannel: "webform",
    defaultAllowed: ["webform", "email"],
    priority: 3,
  },
  {
    key: "truecaller",
    name: "Truecaller",
    category: "People/Phone",
    preferredChannel: "webform",
    defaultAllowed: ["webform", "email"],
    priority: 1,
    regions: ["IN"],
    notes: "High-impact for Indian users (phone/name search).",
  },
  {
    key: "pipl",
    name: "Pipl/People Aggregators",
    category: "People Search",
    preferredChannel: "email",
    defaultAllowed: ["email", "webform"],
    priority: 4,
  },
  {
    key: "haveibeenpwned",
    name: "Have I Been Pwned",
    category: "Breach",
    preferredChannel: "webform",
    defaultAllowed: ["webform"],
    priority: 6,
    notes: "Informational; opt-out possible for email visibility.",
  },
  {
    key: "data-brokers-india",
    name: "Top India Data Brokers (bundle)",
    category: "Data Brokers",
    preferredChannel: "email",
    defaultAllowed: ["email", "letter"],
    priority: 2,
    regions: ["IN"],
    notes: "Bundle batch for common India brokers; requires ID proof.",
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    category: "Professional",
    preferredChannel: "webform",
    defaultAllowed: ["webform", "portal"],
    priority: 5,
  },
  {
    key: "youtube",
    name: "YouTube",
    category: "Video",
    preferredChannel: "webform",
    defaultAllowed: ["webform"],
    priority: 4,
    notes: "Copyright/Privacy takedown routes for non-consensual content.",
  },
];

/** Region policy resolver: tweak channels/weights per region. */
function resolvePolicyByRegion(region?: string | null) {
  const r = (region ?? "").toUpperCase();
  return {
    channelWeight: (ch: Channel): number => {
      if (ch === "webform") return -0.6;
      if (ch === "email") return -0.3;
      if (ch === "portal") return -0.25;
      if (ch === "letter") return r === "EU" ? -0.1 : +0.2;
      if (ch === "fax") return +0.4;
      return 0;
    },
    controllerBoost: (key: string): number => {
      if (r === "IN" && (key === "truecaller" || key === "data-brokers-india")) return -1.0;
      if (r === "EU" && key === "google") return -0.2;
      return 0;
    },
  };
}

function scoreItem(
  item: Omit<PlanItem, "_score"> & { defaultAllowed: Channel[]; priority: number },
  policy: ReturnType<typeof resolvePolicyByRegion>
): number {
  const base = item.priority;
  const chanBias = policy.channelWeight(item.preferredChannel ?? "email");
  const ctrlBias = policy.controllerBoost(item.key);
  // Lower score is better (we sort ascending)
  return base + chanBias + ctrlBias;
}

export async function POST(req: Request) {
  let body: PlanInput = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // ignore, use empty body
  }

  // accept either 'subject' or 'fullName'
  const subject = String((body.subject ?? body.fullName ?? "") || "").trim();
  const region = (body.region ?? "").trim() || null;
  const cats = Array.isArray(body.categories) ? body.categories : null;
  const chans = Array.isArray(body.channels) ? (body.channels as Channel[]) : null;

  const policy = resolvePolicyByRegion(region);

  // Region filter
  let rows = CONTROLLERS.filter((c) => {
    if (c.regions && region) return c.regions.includes(region.toUpperCase());
    if (c.regions && !region) return false;
    return true;
  }).map<PlanItem & { defaultAllowed: Channel[]; priority: number; _score: number }>((c) => ({
    key: c.key,
    name: c.name,
    category: c.category ?? null,
    preferredChannel: c.preferredChannel ?? null,
    allowedChannels: c.defaultAllowed ?? null,
    requires: c.requires ?? null,
    notes: c.notes ?? null,
    defaultAllowed: c.defaultAllowed,
    priority: c.priority,
    _score: scoreItem(c, policy),
  }));

  // Optional category filter
  if (cats?.length) {
    const set = new Set(cats.map((s) => String(s).toLowerCase()));
    rows = rows.filter((r) => (r.category ? set.has(r.category.toLowerCase()) : false));
  }

  // Optional channel filter (keep only overlapping channels, drop if none)
  if (chans?.length) {
    const set = new Set(chans);
    rows = rows
      .map((r) => {
        const overlap = (r.allowedChannels ?? []).filter((c) => set.has(c));
        return { ...r, allowedChannels: overlap.length ? overlap : null };
      })
      .filter((r) => r.allowedChannels && r.allowedChannels.length > 0);
  }

  // Subject-based nudge (media => boost youtube slightly)
  if (subject) {
    const s = subject.toLowerCase();
    const media = s.includes("image") || s.includes("video") || s.includes("photo") || s.includes("clip");
    if (media) {
      rows = rows.map((r) => ({
        ...r,
        _score: r._score + (["youtube"].includes(r.key) ? -0.8 : 0),
      }));
    }
  }

  // Sort by score asc, then key asc; strip internals
  rows.sort((a, b) => a._score - b._score || a.key.localeCompare(b.key));
  const plan: PlanItem[] = rows.map(({ _score, defaultAllowed, priority, ...rest }) => rest);

  return json({ ok: true, region, total: plan.length, plan }, { status: 200 });
}
