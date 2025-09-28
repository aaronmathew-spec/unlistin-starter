'use client'

import { useState } from 'react'
import supabase from '@/lib/supabaseClient'   // ✅ default import (no curly braces)

export default function AuthForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })

    if (error) setMsg(error.message)
    else setMsg('Check your email for the magic link.')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Sending…' : 'Send magic link'}
      </button>
      {msg && <p>{msg}</p>}
    </form>
  )
}
