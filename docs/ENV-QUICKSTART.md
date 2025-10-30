# Env Quickstart (UnlistIN Ops & AI)

Set these in Vercel → Project → Environment Variables for **Preview** and **Production**.

## Core
- `NEXT_PUBLIC_SUPABASE_URL` = https://<your-project>.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = <Supabase anon key>
- `SUPABASE_SERVICE_ROLE` = <service role key>  _(server-only jobs; avoid using in request paths)_
- `OPS_DASHBOARD_TOKEN` = <random-long>  _(cookie gate for /ops middleware)_
- `SECURE_CRON_SECRET` = <random-long>  _(header `x-secure-cron` for internal dispatch)_

## AI Search
- `FEATURE_AI_SERVER` = `1`
- `FEATURE_AI_FTS` = `0` or `1`  _(enable after running `2025-10-25_ai_search_fts.sql`)_

## Rate Limiting (optional)
- `UPSTASH_REDIS_REST_URL` = https://<id>.upstash.io
- `UPSTASH_REDIS_REST_TOKEN` = <token>

## Notes
- Keep server routes on `runtime = "nodejs"`.
- Use `required("NAME")` from `@/lib/env` so misconfigured envs fail fast at runtime.
- # ENV Quickstart

This project runs on **Next.js 14.2.5** with **Supabase**, and expects a set of environment variables.
Create a `.env.local` at the repo root with the following keys:

```bash
# --- Supabase (required) ---
NEXT_PUBLIC_SUPABASE_URL="https://<your-project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
SUPABASE_SERVICE_ROLE="<service-role-key>"

# --- Ops Gate / Security (required) ---
OPS_DASHBOARD_TOKEN="<any-strong-random-string>"   # cookie value for /ops/*
SECURE_CRON_SECRET="<any-strong-random-string>"    # header x-secure-cron for server fan-out

# --- Optional Feature Flags ---
FEATURE_AI_SERVER="1"   # keep on to enable /api/ai/tools/*
FEATURE_AI_FTS="0"      # turn to 1 only after creating FTS columns/migrations

# --- Optional: Upstash Rate Limit ---
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# --- Optional: base URL for server-to-server fetches (prod recommended) ---
NEXT_PUBLIC_BASE_URL="https://<your-vercel-domain>"

