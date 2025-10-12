import { AgentState, AgentResult } from "./types";
import { discoveryAgent } from "./discovery";
import { policySynthesizerAgent } from "./policy-synthesizer";
import { createClient } from "@supabase/supabase-js";

// Database helper
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function decideNextAgent(state: AgentState): string {
  console.log(`[Supervisor] Current stage: ${state.stage}`);

  // Check for fatal errors
  const fatalError = state.errors.find((e) => !e.recoverable);
  if (fatalError) {
    console.log(`[Supervisor] Fatal error detected`);
    return "END";
  }

  // Stage-based routing
  switch (state.stage) {
    case "initializing":
    case "discovery":
      if (state.discoveredItems.length < 10) {
        return "discovery";
      }
      return "policy_synthesizer";

    case "policy_synthesis":
      const itemsWithPolicies = state.discoveredItems.filter((item) =>
        state.policies.some((p) => p.source === item.source)
      );
      if (itemsWithPolicies.length < state.discoveredItems.length) {
        return "policy_synthesizer";
      }
      return "END"; // For now, stop after policy synthesis

    case "completed":
    case "failed":
      return "END";

    default:
      return "END";
  }
}

const AGENT_REGISTRY: Record<string, (state: AgentState) => Promise<AgentResult>> = {
  discovery: discoveryAgent,
  policy_synthesizer: policySynthesizerAgent,
};

async function persistAgentState(state: AgentState): Promise<void> {
  const supabase = db();

  await supabase
    .from("agent_runs")
    .upsert({
      id: state.taskId,
      subject_id: state.subjectId,
      org_id: state.orgId,
      agent: "supervisor",
      state: state,
      status: state.stage,
      updated_at: new Date().toISOString(),
    });
}

export async function supervisorAgent(state: AgentState): Promise<AgentResult> {
  console.log(`[Supervisor] Orchestrating workflow for task ${state.taskId}`);

  try {
    const nextAgentName = decideNextAgent(state);

    if (nextAgentName === "END") {
      console.log(`[Supervisor] Workflow completed`);
      return {
        success: true,
        updatedState: {
          stage: "completed",
          metadata: {
            ...state.metadata,
            lastUpdatedAt: new Date(),
            progress: {
              discoveryPercent: 100,
              policyPercent: 100,
              requestPercent: 100,
              verificationPercent: 100,
            },
          },
        },
      };
    }

    const agent = AGENT_REGISTRY[nextAgentName];
    if (!agent) {
      throw new Error(`Agent not implemented: ${nextAgentName}`);
    }

    console.log(`[Supervisor] Delegating to ${nextAgentName}`);
    const result = await agent(state);

    await persistAgentState({
      ...state,
      ...result.updatedState,
    });

    return result;
  } catch (error: any) {
    console.error("[Supervisor] Error:", error);

    return {
      success: false,
      updatedState: {
        stage: "failed",
        errors: [
          ...state.errors,
          {
            agent: "supervisor",
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

export async function executeWorkflow(
  initialState: AgentState,
  maxIterations: number = 20
): Promise<AgentState> {
  let currentState = initialState;
  let iteration = 0;

  while (iteration < maxIterations) {
    console.log(`[Workflow] Iteration ${iteration + 1}/${maxIterations}`);

    const result = await supervisorAgent(currentState);

    currentState = {
      ...currentState,
      ...result.updatedState,
    };

    if (currentState.stage === "completed" || currentState.stage === "failed") {
      console.log(`[Workflow] Completed with stage: ${currentState.stage}`);
      break;
    }

    if (!result.success) {
      console.error(`[Workflow] Agent failed: ${result.error}`);
      break;
    }

    iteration++;
  }

  if (iteration >= maxIterations) {
    console.warn(`[Workflow] Max iterations reached`);
    currentState.stage = "failed";
  }

  return currentState;
}
