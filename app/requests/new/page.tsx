'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewRequestPage() {
  const router = useRouter()
  const [siteUrl, setSiteUrl] = useState('')
  const [category, setCategory] = useState('Search Engine')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // IMPORTANT: use removal_url (server accepts url too, but let’s be explicit)
          removal_url: siteUrl,
          category,
          notes,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        // show the server error
        alert(json?.error || 'Failed to create.')
        return
      }

      // Success – back to list
      router.push('/requests')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>UnlistIN</h1>
        <nav style={{ display: 'flex', gap: 16 }}>
          <a href="/" style={{ color: 'purple' }}>Home</a>
          <a href="/requests" style={{ color: 'purple' }}>Requests</a>
          <a href="/dashboard" style={{ color: 'purple' }}>Dashboard</a>
        </nav>
      </div>

      <h2 style={{ marginTop: 24 }}>New Removal Request</h2>

      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Site URL *</span>
          <input
            required
            type="url"
            placeholder="https://www.example.com"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6, marginTop: 16 }}>
          <span>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
          >
            {[
              'Search Engine',
              'Data Broker',
              'Social Network',
              'News / Article',
              'Forum / Misc',
            ].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6, marginTop: 16 }}>
          <span>Notes</span>
          <textarea
            rows={5}
            placeholder="Any extra context…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: 20,
            padding: '10px 14px',
            background: '#111',
            color: '#fff',
            borderRadius: 6,
            border: '1px solid #111',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Create Request'}
        </button>
      </form>
    </div>
  )
}
