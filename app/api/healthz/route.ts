/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

/**
 * GET /api/healthz
 * Lightweight liveness/readiness probe.
 * Keep it dependency-light to avoid causing failures during cold starts.
 */
export async function GET() {
  const now = new Date().toISOString();

  // Prefer Vercel metadata when present; fall back to envs you likely have.
  const build = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_SHA || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || process.env.NEXT_PUBLIC_GIT_BRANCH || null,
    vercelEnv: process.env.VERCEL_ENV || null,
  };

  // Feature flags snapshot (safe; these are public envs in your app already)
  const flags = {
    NEXT_PUBLIC_FEATURE_AI: process.env.NEXT_PUBLIC_FEATURE_AI ?? "0",
    NEXT_PUBLIC_FEATURE_AGENTS: process.env.NEXT_PUBLIC_FEATURE_AGENTS ?? "0",
  };

  // If you later want to add a DB ping, do it behind try/catch and keep it optional.
  return json({
    ok: true,
    status: "healthy",
    time: now,
    build,
    flags,
  });
}
