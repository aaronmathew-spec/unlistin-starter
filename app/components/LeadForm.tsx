'use client'

import { useState } from 'react'

export default function LeadForm() {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    if (!name.trim()) {
      setMsg({ ok: false, text: 'Please enter your full name.' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          city_state: city || null,
          email: email || null,
          source: 'site',
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setMsg({ ok: true, text: "Scan queued! We'll email results soon." })
        setName('')
        setCity('')
        setEmail('')
      } else {
        setMsg({
          ok: false,
          text: (data && (data.error || data.message)) || 'Could not queue scan.',
        })
      }
    } catch {
      setMsg({ ok: false, text: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-3 sm:grid-cols-3">
      <input
        className="w-full rounded-md border px-3 py-2"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        className="w-full rounded-md border px-3 py-2"
        placeholder="City / State (optional)"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />
      <input
        className="w-full rounded-md border px-3 py-2"
        placeholder="Email (optional)"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        type="submit"
        disabled={loading}
        className="sm:col-span-3 rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
      >
        {loading ? 'Submitting…' : 'Instant scan'}
      </button>

      {msg && (
        <p
          className={`sm:col-span-3 text-sm ${
            msg.ok ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {msg.text}
        </p>
      )}
    </form>
  )
}
