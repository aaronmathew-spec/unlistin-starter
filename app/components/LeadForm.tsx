// app/components/LeadForm.tsx
'use client'

import { useState } from 'react'

export default function LeadForm() {
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setMsg(null)

    const fd = new FormData(e.currentTarget)
    const payload = {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      city_state: String(fd.get('city_state') || '').trim(),
      source: 'site'
    }

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Submit failed')
      setMsg('Thanks! We received your info.')
      e.currentTarget.reset()
    } catch (err: any) {
      setMsg(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input name="name" required className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input name="email" type="email" required className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium">City, State</label>
        <input name="city_state" placeholder="e.g., Mumbai, MH" className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-60">
        {submitting ? 'Submitting…' : 'Get scan & updates'}
      </button>
      {msg && <p className="text-sm mt-2">{msg}</p>}
    </form>
  )
}
