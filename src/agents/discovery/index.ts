import { AgentState, AgentResult, DiscoveredItem, DISCOVERY_TARGETS } from "../types";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// Database helper using YOUR pattern
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function normalizePhone(phone: string) {
  // keep + and digits only
  return phone.replace(/[^\d+]/g, "");
}

async function getControllerIdByName(name: string): Promise<string | null> {
  const supabase = db();
  const { data, error } = await supabase
    .from("controllers")
    .select("id")
    .eq("name", name)
    .limit(1)
    .single();

  if (error) {
    console.warn(`[Discovery] controllers lookup failed for ${name}:`, error.message);
    return null;
  }
  return data?.id ?? null;
}

// Truecaller crawler (URL synthesis; verification will do the proof)
async function crawlTruecaller(phone: string): Promise<DiscoveredItem[]> {
  const normalizedPhone = normalizePhone(phone);
  console.log(`[Discovery] Crawling Truecaller for ${normalizedPhone}`);

  const controllerId = await getControllerIdByName("Truecaller");
  if (!controllerId) {
    console.log("[Discovery] Truecaller controller not found");
    return [];
  }

  const item: DiscoveredItem = {
    id: randomUUID(),
    source: "Truecaller",
    sourceType: "caller_id",
    url: `https://www.truecaller.com/search/in/${encodeURIComponent(normalizedPhone)}`,
    dataType: "phone",
    confidence: 0.85,
    evidence: {
      metadata: {
        method: "web_search",
        timestamp: new Date().toISOString(),
      },
    },
    discoveredAt: new Date(),
    // NOTE: DiscoveredItem type likely doesn’t include controllerId;
    // we’ll attach controller_id at insert time below.
  };

  // Stash controllerId in evidence for now (doesn't hurt; optional)
  (item.evidence as any).controllerHint = controllerId;

  return [item];
}

// JustDial crawler (URL synthesis)
async function crawlJustDial(phone: string): Promise<DiscoveredItem[]> {
  const normalizedPhone = normalizePhone(phone);
  console.log(`[Discovery] Crawling JustDial for ${normalizedPhone}`);

  const controllerId = await getControllerIdByName("JustDial");
  if (!controllerId) {
    console.log("[Discovery] JustDial controller not found");
    return [];
  }

  const item: DiscoveredItem = {
    id: randomUUID(),
    source: "JustDial",
    sourceType: "directory",
    url: `https://www.justdial.com/search?q=${encodeURIComponent(normalizedPhone)}`,
    dataType: "phone",
    confidence: 0.75,
    evidence: {
      metadata: {
        method: "web_search",
        timestamp: new Date().toISOString(),
      },
    },
    discoveredAt: new Date(),
  };

  (item.evidence as any).controllerHint = controllerId;

  return [item];
}

// Main discovery agent
export async function discoveryAgent(state: AgentState): Promise<AgentResult> {
  console.log(`[Discovery Agent] Starting for subject ${state.subjectId}`);

  try {
    const { phone, email } = state.subject || {};

    if (!phone && !email) {
      return {
        success: false,
        updatedState: {
          stage: "failed",
          errors: [
            ...state.errors,
            {
              agent: "discovery",
              error: "No phone or email provided",
              timestamp: new Date(),
              recoverable: false,
            },
          ],
        },
        error: "No identifiers provided",
      };
    }

    // Run crawlers in parallel (extend with email/name providers later)
    const crawlers = [
      phone ? crawlTruecaller(phone) : Promise.resolve([]),
      phone ? crawlJustDial(phone) : Promise.resolve([]),
    ];

    const results = await Promise.all(crawlers);
    const newItems = results.flat();

    // Deduplicate (source + url key)
    const existingKeys = new Set(
      (state.discoveredItems || []).map((item) => `${item.source}:${item.url}`)
    );
    const uniqueNewItems = newItems.filter(
      (item) => !existingKeys.has(`${item.source}:${item.url}`)
    );

    console.log(`[Discovery Agent] Found ${uniqueNewItems.length} new items`);

    // Persist to database
    if (uniqueNewItems.length > 0) {
      const supabase = db();

      // Resolve controller_id for each item (if present in evidence.controllerHint)
      const rows = await Promise.all(
        uniqueNewItems.map(async (item) => {
          let controllerId: string | null = null;

          // Prefer explicit lookup when we know the name
          if (item.source === "Truecaller") {
            controllerId = await getControllerIdByName("Truecaller");
          } else if (item.source === "JustDial") {
            controllerId = await getControllerIdByName("JustDial");
          }

          // fallback: evidence hint (if we ever pre-attached it)
          if (!controllerId && item.evidence && (item.evidence as any).controllerHint) {
            controllerId = (item.evidence as any).controllerHint as string;
          }

          return {
            id: item.id, // uuid, OK
            subject_id: state.subjectId,
            controller_id: controllerId, // may be null if unknown
            source: item.source,
            url: item.url,
            data_type: item.dataType,
            confidence: item.confidence,
            evidence: item.evidence ?? null,
            status: "pending",
            created_at: item.discoveredAt?.toISOString?.() ?? new Date().toISOString(),
          };
        })
      );

      const { error: insertErr } = await supabase.from("discovered_items").insert(rows);
      if (insertErr) {
        throw new Error(`[Discovery Agent] insert failed: ${insertErr.message}`);
      }
    }

    const totalItems = (state.discoveredItems?.length || 0) + uniqueNewItems.length;
    const shouldContinue = totalItems < DISCOVERY_TARGETS.TARGET_SOURCES;

    return {
      success: true,
      updatedState: {
        stage: shouldContinue ? "discovery" : "policy_synthesis",
        discoveredItems: [...(state.discoveredItems || []), ...uniqueNewItems],
        metadata: {
          ...state.metadata,
          lastUpdatedAt: new Date(),
          progress: {
            ...state.metadata.progress,
            discoveryPercent: Math.min(
              (totalItems / DISCOVERY_TARGETS.TARGET_SOURCES) * 100,
              100
            ),
          },
        },
      },
      nextAgent: shouldContinue ? "discovery" : "policy_synthesizer",
    };
  } catch (error: any) {
    console.error("[Discovery Agent] Error:", error);
    return {
      success: false,
      updatedState: {
        stage: "failed",
        errors: [
          ...state.errors,
          {
            agent: "discovery",
            error: error?.message || String(error),
            timestamp: new Date(),
            recoverable: false,
          },
        ],
      },
      error: error?.message || "Discovery error",
    };
  }
}
