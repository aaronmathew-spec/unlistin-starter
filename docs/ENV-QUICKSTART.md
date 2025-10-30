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
