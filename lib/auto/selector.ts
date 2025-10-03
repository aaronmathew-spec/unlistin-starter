/* eslint-disable @typescript-eslint/no-explicit-any */
import { isAllowed } from "@/lib/scan/domains-allowlist";
import { getCapability } from "@/lib/auto/capability";
import { loadControlsMap, isKilled, minConfidence, underDailyCap } from "@/lib/auto/controls";

/** Shape we expect from upstream normalized hits (tolerant) */
export type CandidateHit = {
  broker?: string;
  category?: string;
  adapter?: string;
  state?: string | null;
  confidence?: number;
  url?: string;
  evidence?: Array<{ url: string }>;

  // carry-through fields used by callers (e.g., auto/run route)
  preview?: { email?: string; name?: string; city?: string };
  why?: string[];

  // optional proto-draft bits
  redacted_identity?: any;
  draft_subject?: string;
  draft_body?: string;
  fields?: Record<string, any>;
  reply_channel?: "email" | "portal" | "form";
  reply_email_preview?: string | null;
};

export type GateResult = CandidateHit & {
  __adapter: string;
  __threshold: number;
};

/**
 * Applies admin gates + capability defaults to a batch of candidate hits.
 * - Kill switch
 * - Daily cap (counts 'sent' if opts.countSent; here we usually gate for 'prepared')
 * - Min confidence (adapter_controls override -> capability default -> 0.82)
 * - Allowlist on first evidence URL
 */
export async function gateCandidates(
  hits: CandidateHit[],
  opts?: { countSent?: boolean }
): Promise<GateResult[]> {
  if (!Array.isArray(hits) || hits.length === 0) return [];

  const controls = await loadControlsMap();
  const out: GateResult[] = [];

  for (const h of hits) {
    const url = firstUrl(h);
    if (!url || !isAllowed(url)) continue;

    const adapterId = String(h.adapter || inferAdapterFrom(h.broker, url)).toLowerCase();

    // kill switch
    if (isKilled(controls, adapterId)) continue;

    // daily cap (prepare-stage by default; set countSent=true to cap on 'sent')
    const capOk = await underDailyCap(adapterId, { countSent: !!opts?.countSent });
    if (!capOk) continue;

    // min-confidence with fallback
    const cap = getCapability(adapterId);
    const threshold = minConfidence(controls, adapterId, cap.defaultMinConfidence ?? 0.82);
    const conf = Number.isFinite(h.confidence) ? Number(h.confidence) : 1;
    if (conf < threshold) continue;

    // channel sanity (we prefer email in phase 1; keep flexible)
    const chan = (h.reply_channel || "email") as CandidateHit["reply_channel"];
    if (chan === "portal") {
      // portals usually need OTP/login; we still allow prepare (no auto-submit)
    }

    out.push({ ...h, __adapter: adapterId, __threshold: threshold });
  }

  return out;
}

function firstUrl(h: CandidateHit): string | null {
  const u = (Array.isArray(h.evidence) && h.evidence[0]?.url) || h.url || null;
  return u || null;
}

function inferAdapterFrom(broker?: string, url?: string) {
  const s = (broker || url || "").toLowerCase();
  if (s.includes("justdial")) return "justdial";
  if (s.includes("sulekha")) return "sulekha";
  if (s.includes("indiamart")) return "indiamart";
  return "generic";
}
