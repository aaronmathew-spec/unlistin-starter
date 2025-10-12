// src/lib/orchestrator/supervisor.ts
import { DeletionState, Stage } from "./types";

export function nextNode(state: DeletionState): Stage {
  if (state.stage === "discovery" && state.discoveredItems.length < 10) return "discovery";
  if (state.stage === "discovery" && state.discoveredItems.length >= 10) return "policy";
  if (state.stage === "policy") return "request";
  if (state.stage === "request") return "dispatch";
  if (state.stage === "dispatch") return "verification";
  if (state.stage === "verification") return "verification";
  return "completed";
}
