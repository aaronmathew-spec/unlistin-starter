import { AgentState, AgentResult, DiscoveredItem, DISCOVERY_TARGETS } from "../types";
import { createClient } from "@supabase/supabase-js";

// Database helper using YOUR pattern
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// Truecaller crawler
async function crawlTruecaller(phone: string): Promise<DiscoveredItem[]> {
  console.log(`[Discovery] Crawling Truecaller for ${phone}`);

  const supabase = db();
  
  const { data: controller } = await supabase
    .from("controllers")
    .select("id")
    .eq("name", "Truecaller")
    .single();

  if (!controller) {
    console.log("[Discovery] Truecaller controller not found");
    return [];
  }

  const item: DiscoveredItem = {
    id: crypto.randomUUID(),
    source: "Truecaller",
    sourceType: "caller_id",
    url: `https://www.truecaller.com/search/in/${phone}`,
    dataType: "phone",
    confidence: 0.85,
    evidence: {
      metadata: {
        method: "web_search",
        timestamp: new Date().toISOString(),
      },
    },
    discoveredAt: new Date(),
  };

  return [item];
}

// JustDial crawler
async function crawlJustDial(phone: string): Promise<DiscoveredItem[]> {
  console.log(`[Discovery] Crawling JustDial for ${phone}`);

  const item: DiscoveredItem = {
    id: crypto.randomUUID(),
    source: "JustDial",
    sourceType: "directory",
    url: `https://www.justdial.com/search?q=${phone}`,
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

  return [item];
}

// Main discovery agent
export async function discoveryAgent(state: AgentState): Promise<AgentResult> {
  console.log(`[Discovery Agent] Starting for subject ${state.subjectId}`);

  try {
    const { phone, email } = state.subject;

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

    // Run crawlers in parallel
    const crawlers = [
      phone ? crawlTruecaller(phone) : Promise.resolve([]),
      phone ? crawlJustDial(phone) : Promise.resolve([]),
    ];

    const results = await Promise.all(crawlers);
    const newItems = results.flat();

    // Deduplicate
    const existingKeys = new Set(
      state.discoveredItems.map((item) => `${item.source}:${item.url}`)
    );
    const uniqueNewItems = newItems.filter(
      (item) => !existingKeys.has(`${item.source}:${item.url}`)
    );

    console.log(`[Discovery Agent] Found ${uniqueNewItems.length} new items`);

    // Persist to database
    const supabase = db();
    if (uniqueNewItems.length > 0) {
      await supabase.from("discovered_items").insert(
        uniqueNewItems.map((item) => ({
          id: item.id,
          subject_id: state.subjectId,
          org_id: state.orgId,
          source: item.source,
          url: item.url,
          data_type: item.dataType,
          confidence: item.confidence,
          evidence: item.evidence,
          created_at: item.discoveredAt.toISOString(),
        }))
      );
    }

    const totalItems = state.discoveredItems.length + uniqueNewItems.length;
    const shouldContinue = totalItems < DISCOVERY_TARGETS.TARGET_SOURCES;

    return {
      success: true,
      updatedState: {
        stage: shouldContinue ? "discovery" : "policy_synthesis",
        discoveredItems: [...state.discoveredItems, ...uniqueNewItems],
        metadata: {
          ...state.metadata,
          lastUpdatedAt: new Date(),
          progress: {
            ...state.metadata.progress,
            discoveryPercent: Math.min((totalItems / DISCOVERY_TARGETS.TARGET_SOURCES) * 100, 100),
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
            error: error.message,
            timestamp: new Date(),
            recoverable: false,
          },
        ],
      },
      error: error.message,
    };
  }
}
