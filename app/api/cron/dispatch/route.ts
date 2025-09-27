// app/api/cron/dispatch/route.ts
// One cron to rule them all: hourly worker + daily 03:00 rescan

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['bom1']

function okByHeader(req: Request) {
  const isCron = req.headers.get('x-vercel-cron') === '1'
  const secret = req.headers.get('x-cron-secret')
  if (isCron) return true
  if (process.env.CRON_SECRET && secret === process.env.CRON_SECRET) return true
  return false
}

async function hit(path: string, headers: Record<string, string>) {
  const url = `https://${process.env.NEXT_PUBLIC_SITE_URL || 'unlistin.vercel.app'}${path}`
  const res = await fetch(url, { headers, method: 'GET' })
  const text = await res.text().catch(() => '')
  return { path, status: res.status, body: text.slice(0, 200) }
}

export async function GET(req: Request) {
  if (!okByHeader(req)) return new Response('forbidden', { status: 403 })

  // Headers we pass to internal calls (so they’re authorized)
  const headers: Record<string, string> = {}
  if (process.env.CRON_SECRET) headers['x-cron-secret'] = process.env.CRON_SECRET
  else headers['x-vercel-cron'] = '1'

  // 1) Always run the removal worker hourly
  const calls = [hit('/api/removal-runner', headers)]

  // 2) Run rescan once a day at 03:00 UTC
  const now = new Date()
  if (now.getUTCHours() === 3) {
    calls.push(hit('/api/cron/rescan', headers))
  }

  const results = await Promise.all(calls)
  return Response.json({ ok: true, results })
}
