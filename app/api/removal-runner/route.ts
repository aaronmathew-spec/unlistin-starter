import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only (in Vercel env)
)

async function logEvent(job_id: string, type: string, message: string, meta: any = {}) {
  await supabase.from('removal_events').insert([{ job_id, type, message, meta }])
}
async function setStatus(id: string, status: string, error?: string) {
  await supabase.from('removal_jobs').update({
    status, error: error ?? null, updated_at: new Date().toISOString()
  }).eq('id', id)
}

async function runWorker() {
  const { data: jobs, error } = await supabase
    .from('removal_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('updated_at', { ascending: true })
    .limit(5)

  if (error) return new Response(error.message, { status: 500 })
  if (!jobs?.length) return new Response('no-jobs', { status: 200 })

  for (const job of jobs) {
    try {
      await setStatus(job.id, 'in_progress')
      await logEvent(job.id, 'in_progress', 'Starting removal flow', { site: job.site_id })

      await new Promise(r => setTimeout(r, 600))
      await logEvent(job.id, 'form_submitted', 'Submitted site form', { site: job.site_id })

      await supabase.from('evidence').insert([{
        org_id: job.org_id,
        job_id: job.id,
        path: `org/${job.org_id}/${job.id}/submission.txt`,
        sha256: null
      }])

      await new Promise(r => setTimeout(r, 400))
      await logEvent(job.id, 'completed', 'Site acknowledged request')
      await setStatus(job.id, 'succeeded')
    } catch (e:any) {
      const attempts = (job.attempts ?? 0) + 1
      const willRetry = attempts < (job.max_attempts ?? 5)
      await supabase.from('removal_jobs').update({
        attempts, error: String(e), updated_at: new Date().toISOString(),
        status: willRetry ? 'queued' : 'failed'
      }).eq('id', job.id)
      await logEvent(job.id, 'error', 'Worker error', { error: String(e) })
    }
  }
  return new Response('ok', { status: 200 })
}

export async function GET(request: Request) {
  // secure: only Vercel Cron with header may call
  const secret = request.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new Response('forbidden', { status: 403 })
  }
  return runWorker()
}
