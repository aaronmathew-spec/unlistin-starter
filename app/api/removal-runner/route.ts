// app/api/removal-runner/route.ts
import { createClient } from '@supabase/supabase-js'

// ---- Configure Supabase (server-only key) ----
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,          // e.g. https://xxxx.supabase.co
  process.env.SUPABASE_SERVICE_ROLE_KEY!          // set in Vercel → Project → Settings → Env Vars
)

// (optional, but helps on Vercel)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['bom1']           // Mumbai

// ---- tiny helpers ----
async function logEvent(job_id: string, type: string, message: string, meta: any = {}) {
  await supabase.from('removal_events').insert([{ job_id, type, message, meta }])
}
async function setStatus(id: string, status: string, error?: string) {
  await supabase.from('removal_jobs')
    .update({ status, error: error ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
}

// ---- the worker loop ----
async function runWorker() {
  // pick a few oldest queued jobs
  const { data: jobs, error } = await supabase
    .from('removal_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('updated_at', { ascending: true })
    .limit(5)

  if (error) {
    return new Response(`db error: ${error.message}`, { status: 500 })
  }
  if (!jobs || jobs.length === 0) {
    return new Response('no-jobs', { status: 200 })
  }

  for (const job of jobs) {
    try {
      await setStatus(job.id, 'in_progress')
      await logEvent(job.id, 'in_progress', 'Starting removal flow', { site: job.site_id })

      // ---- your real site-specific steps go here ----
      // mock delay to simulate automation
      await new Promise((r) => setTimeout(r, 500))
      await logEvent(job.id, 'form_submitted', 'Submitted site form')

      // store a small piece of evidence (example)
      await supabase.from('evidence').insert([{
        org_id: job.org_id,
        job_id: job.id,
        path: `org/${job.org_id}/${job.id}/submission.txt`,
        sha256: null
      }])

      await new Promise((r) => setTimeout(r, 300))
      await logEvent(job.id, 'completed', 'Site acknowledged request')
      await setStatus(job.id, 'succeeded')
    } catch (e: any) {
      const attempts = (job.attempts ?? 0) + 1
      const max = job.max_attempts ?? 5
      const willRetry = attempts < max
      await supabase.from('removal_jobs')
        .update({
          attempts,
          error: String(e),
          status: willRetry ? 'queued' : 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
      await logEvent(job.id, 'error', 'Worker error', { error: String(e) })
    }
  }

  return new Response('ok', { status: 200 })
}

// ---- GET handler (Cron and manual testing) ----
export async function GET(req: Request) {
  // Allow from Vercel Cron OR from a caller that knows CRON_SECRET
  const isCron = req.headers.get('x-vercel-cron') === '1'
  const headerSecret = req.headers.get('x-cron-secret')
  const ok =
    isCron ||
    (!!process.env.CRON_SECRET && headerSecret === process.env.CRON_SECRET)

  if (!ok) return new Response('forbidden', { status: 403 })
  return runWorker()
}
