import { NextResponse } from 'next/server'

export const runtime = 'edge' // safe on Vercel

export async function GET(req: Request) {
  // Allow Vercel Cron (header is auto-added) OR manual run with x-vercel-cron: 1
  const isCron = req.headers.get('x-vercel-cron') === '1'
  if (!isCron) {
    return new NextResponse('forbidden', { status: 403 })
  }

  // TODO: call your worker logic here. For now, just 200 OK.
  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
