'use client'

import { useState } from 'react'
import supabase from '@/lib/supabaseClient'

export default function AuthForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })

    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      alert('Check your email for the magic link.')
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
      <input
        type="email"
        required
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: 10 }}
      />
      <button type="submit" disabled={loading} style={{ padding: '10px 14px' }}>
        {loading ? 'Sending…' : 'Send magic link'}
      </button>
    </form>
  )
}
