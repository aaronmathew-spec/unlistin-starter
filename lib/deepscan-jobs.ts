// lib/deepscan-jobs.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

type JobStatus = "queued" | "running" | "complete" | "error";
export type DeepScanInput = {
  query?: string;
  name?: string;
  email?: string;
  city?: string;
  consent: boolean;
  emailVerified?: boolean;
  mask?: boolean; // if true, we'll hash/mask email
};
export type DeepScanResult = {
  source: string;          // e.g., "broker:xyz"
  title: string;           // short label
  snippet: string;         // short evidence (safe)
  confidence: number;      // 0..1
  url?: string;            // landing page for evidence (if applicable)
};
export type DeepScanJob = {
  id: string;
  status: JobStatus;
  pct: number;             // 0..100
  createdAt: number;       // ms
  etaMs: number;           // ms (simulated)
  input: DeepScanInput;
  results?: DeepScanResult[];
  error?: string;
};

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

let memory: Map<string, DeepScanJob> | null = null;
function mem() {
  if (!memory) memory = new Map();
  return memory!;
}

async function getRedis() {
  if (!hasUpstash) return null;
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

async function rget(jobId: string): Promise<DeepScanJob | null> {
  const redis = await getRedis();
  if (!redis) return mem().get(jobId) ?? null;
  const raw = await redis.get<DeepScanJob>(`ds:job:${jobId}`);
  return raw ?? null;
}
async function rset(job: DeepScanJob): Promise<void> {
  const redis = await getRedis();
  if (!redis) {
    mem().set(job.id, job);
    return;
  }
  // keep jobs for 2h
  await redis.set(`ds:job:${job.id}`, job, { ex: 60 * 60 * 2 });
}

function uid() {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

// --- Demo result generator (safe/placeholder) ---
function hashEmail(email?: string) {
  if (!email) return "noemail";
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = (h * 31 + email.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

function maskedEmail(email?: string) {
  if (!email) return "";
  const [user, domain] = email.split("@");
  if (!domain || !user) return email.replace(/(.).+(@.*)/, "$1***$2");
  const u =
    user.length <= 2 ? user[0] + "*" : user[0] + "*".repeat(user.length - 2) + user[user.length - 1];
  const parts = domain.split(".");
  const d0 = parts[0] ?? "";
  const dRed = d0.length <= 2 ? d0[0] + "*" : d0[0] + "*".repeat(Math.max(0, d0.length - 2)) + d0[d0.length - 1];
  parts[0] = dRed;
  return `${u}@${parts.join(".")}`;
}

function demoResults(input: DeepScanInput): DeepScanResult[] {
  const emailKey = input.mask ? hashEmail(input.email) : (input.email ?? "unknown");
  const who = input.name?.trim() || "user";
  const city = input.city?.trim() || "India";
  const safeEmail = input.mask ? maskedEmail(input.email) : (input.email ?? "");

  // fake but deterministic-ish
  const base = emailKey.slice(0, 6);
  return [
    {
      source: "broker:people-index.in",
      title: `Listing likely for ${who}`,
      snippet: `Matched name & city (${city}). Email hint: ${safeEmail || "n/a"}.`,
      confidence: 0.78,
      url: "https://people-index.in/",
    },
    {
      source: "broker:contact-lookup.in",
      title: "Phone / email trace",
      snippet: `Potential contact record tied to ${safeEmail || who}.`,
      confidence: 0.66,
      url: "https://contact-lookup.in/",
    },
    {
      source: "breach:public-paste",
      title: "Public paste mention",
      snippet: `Found a mention of ${who} (email hash ${hashEmail(input.email)}).`,
      confidence: 0.41,
    },
  ];
}

// Compute live-ish progress each poll based on elapsed time.
function withProgress(job: DeepScanJob): DeepScanJob {
  if (job.status === "complete" || job.status === "error") return job;
  const elapsed = Date.now() - job.createdAt;
  const pct = Math.min(100, Math.round((elapsed / job.etaMs) * 100));
  if (pct >= 100) {
    job.status = "complete";
    job.pct = 100;
    job.results = job.results && job.results.length
      ? job.results
      : demoResults(job.input);
  } else {
    job.status = "running";
    job.pct = pct;
  }
  return job;
}

export async function createDeepScanJob(input: DeepScanInput): Promise<DeepScanJob> {
  const id = uid();
  const job: DeepScanJob = {
    id,
    status: "queued",
    pct: 0,
    createdAt: Date.now(),
    etaMs: 45_000, // simulate 45s deep scan
    input: input,
    results: [],
  };
  await rset(job);
  // immediately set to running so UI shows progress
  job.status = "running";
  await rset(job);
  return job;
}

export async function getDeepScanJob(jobId: string): Promise<DeepScanJob | null> {
  const job = await rget(jobId);
  if (!job) return null;
  const progressed = withProgress({ ...job });
  if (progressed.status !== job.status || progressed.pct !== job.pct || progressed.results !== job.results) {
    await rset(progressed);
  }
  return progressed;
}

export async function failDeepScanJob(jobId: string, message: string) {
  const job = await rget(jobId);
  if (!job) return;
  job.status = "error";
  job.error = message;
  job.pct = job.pct || 0;
  await rset(job);
}
