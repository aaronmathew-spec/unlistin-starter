// app/api/subject/authorization/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorization, getAuthorization } from "@/src/lib/authz/store";

/** ---------- Security / Guards ---------- */
function assertAllowed(req: Request) {
  // Require exact match with INTERNAL_API_KEY (set in env).
  const provided = req.headers.get("x-internal-key")?.trim();
  const expected = process.env.INTERNAL_API_KEY?.trim();
  return !!provided && !!expected && provided === expected;
}

/** ---------- Simple in-memory rate limiter (server instance scoped) ---------- */
type RLKey = string;
const RL_WINDOW_MS = 60_000; // 1 minute window
const RL_MAX_HITS = 10;      // 10 requests per window
const rlMap: Map<RLKey, { count: number; resetAt: number }> = new Map();

function rlKeyFrom(req: Request, subjectId?: string | null, email?: string | null) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    (req as any).ip ||
    "unknown";
  const sid = (subjectId || "").trim().toLowerCase();
  const em = (email || "").trim().toLowerCase();
  return `ip:${ip}|sid:${sid}|em:${em}`;
}

function rateLimitCheck(key: RLKey) {
  const now = Date.now();
  const entry = rlMap.get(key);
  if (!entry || now > entry.resetAt) {
    rlMap.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return { ok: true, remaining: RL_MAX_HITS - 1, resetAt: now + RL_WINDOW_MS };
  }
  if (entry.count >= RL_MAX_HITS) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { ok: true, remaining: RL_MAX_HITS - entry.count, resetAt: entry.resetAt };
}

/** ---------- Schemas ---------- */
const ArtifactSchema = z.object({
  filename: z.string().min(1),
  mime: z.string().min(1),
  base64: z.string().min(1), // raw base64 (no data: prefix)
});

const BodySchema = z.object({
  subject: z.object({
    subjectId: z.string().optional().nullable(),
    fullName: z.string().min(1),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    region: z.string().optional().nullable(),
  }),
  signerName: z.string().min(1),
  signedAt: z.string().min(1),    // ISO datetime string
  consentText: z.string().min(1), // LoA / consent copy text
  artifacts: z.array(ArtifactSchema).optional(),
});

/** ---------- Helpers ---------- */
function bad(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function log(event: string, payload: Record<string, unknown>) {
  // Single-line structured log for easy grep
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }));
}

/** ---------- Routes ---------- */
export async function POST(req: Request) {
  try {
    if (!assertAllowed(req)) {
      log("authz_forbidden", { reason: "header_mismatch" });
      return bad("forbidden", 403);
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      log("authz_invalid", { issues: parsed.error.flatten() });
      return bad("invalid_body", 400, { issues: parsed.error.flatten() });
    }

    const subj = parsed.data.subject;
    const rlKey = rlKeyFrom(req, subj.subjectId ?? null, subj.email ?? null);
    const rl = rateLimitCheck(rlKey);
    if (!rl.ok) {
      log("authz_rate_limited", { key: rlKey, resetAt: rl.resetAt });
      return bad("rate_limited", 429, { resetAt: rl.resetAt });
    }

    const res = await createAuthorization(parsed.data);

    log("authz_created", {
      id: res.record.id,
      manifest_hash: res.record.manifest_hash,
      files: res.files.length,
    });

    return NextResponse.json({
      ok: true,
      id: res.record.id,
      manifest_hash: res.record.manifest_hash,
      record: res.record,
      files: res.files,
      manifest: res.manifest, // shaped by builder; includes integrity.hashHex when present
    });
  } catch (e: any) {
    log("authz_error", { error: String(e?.message || e) });
    return bad(String(e?.message || e), 500);
  }
}

// GET /api/subject/authorization?id=...
export async function GET(req: Request) {
  try {
    if (!assertAllowed(req)) {
      log("authz_get_forbidden", {});
      return bad("forbidden", 403);
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return bad("missing_id");

    const { record, files } = await getAuthorization(id);
    if (!record) return bad("not_found", 404);

    log("authz_get_ok", { id, files: files.length });
    return NextResponse.json({ ok: true, record, files });
  } catch (e: any) {
    log("authz_get_error", { error: String(e?.message || e) });
    return bad(String(e?.message || e), 500);
  }
}
