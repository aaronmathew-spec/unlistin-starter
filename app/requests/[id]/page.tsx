'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import supabase from '@/lib/supabaseClient'

type Req = {
  id: number
  created_at: string
  category: string | null
  status: string | null
  notes: string | null
  removal_url?: string | null
}

type FileRow = {
  id: number
  name: string
  mime: string | null
  size_bytes: number | null
  url: string | null
  created_at: string
}

const CATEGORIES = ['profile', 'post', 'image', 'other'] as const
const STATUSES = ['new', 'queued', 'in_progress', 'done'] as const

export default function RequestDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const requestId = useMemo(() => Number(params?.id), [params?.id])

  const [row, setRow] = useState<Req | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [files, setFiles] = useState<FileRow[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load the request row
  useEffect(() => {
    if (!requestId) return
    let mounted = true
    ;(async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        if (!auth?.user) {
          router.push('/')
          return
        }

        const { data, error } = await supabase
          .from('requests')
          .select('id, created_at, category, status, notes, removal_url')
          .eq('id', requestId)
          .single()

        if (error) throw error
        if (!mounted) return
        setRow(data as Req)
      } catch (e) {
        console.error(e)
        alert('Failed to load request')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [requestId, router])

  // Load files
  async function loadFiles() {
    if (!requestId) return
    try {
      const res = await fetch(`/api/requests/${requestId}/files`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load files')
      setFiles(data.files || [])
    } catch (e) {
      console.error(e)
      alert('Failed to load files')
    }
  }

  useEffect(() => {
    loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  async function save() {
    if (!row) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('requests')
        .update({
          category: row.category,
          status: row.status,
          notes: row.notes,
          removal_url: row.removal_url ?? null
        })
        .eq('id', row.id)
      if (error) throw error
      alert('Saved ✅')
    } catch (e) {
      console.error(e)
      alert('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function uploadFile(file: File) {
    try {
      const form = new FormData()
      form.append('file', file)
      setUploading(true)
      const res = await fetch(`/api/requests/${requestId}/files`, {
        method: 'POST',
        body: form
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Upload failed')
      await loadFiles()
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      console.error(e)
      alert((e as any).message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>
  if (!row) return <div style={{ padding: 24 }}>Not found.</div>

  return (
    <div style={{ maxWidth: 960, margin: '40px auto', padding: 16 }}>
      {/* Top nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>UnlistIN</h1>
        <nav style={{ display: 'flex', gap: 16 }}>
          <a href="/" style={{ color: 'purple' }}>Home</a>
          <a href="/requests" style={{ color: 'purple' }}>Requests</a>
        </nav>
      </div>

      <h2 style={{ marginTop: 24 }}>Request #{row.id}</h2>
      <p style={{ color: '#666' }}>{new Date(row.created_at).toLocaleString()}</p>

      {/* Edit form */}
      <div style={{ display: 'grid', gap: 12, maxWidth: 660 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Category</span>
          <select
            value={row.category ?? 'profile'}
            onChange={(e) => setRow({ ...row, category: e.target.value })}
            style={{ padding: 8 }}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Status</span>
          <select
            value={row.status ?? 'new'}
            onChange={(e) => setRow({ ...row, status: e.target.value })}
            style={{ padding: 8 }}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Profile / Link to remove</span>
          <input
            value={row.removal_url ?? ''}
            onChange={(e) => setRow({ ...row, removal_url: e.target.value })}
            placeholder="https://example.com/profile/123"
            style={{ padding: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Notes</span>
          <textarea
            rows={4}
            value={row.notes ?? ''}
            onChange={(e) => setRow({ ...row, notes: e.target.value })}
            style={{ padding: 8 }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={saving} style={{ padding: '10px 14px' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => router.push('/requests')} style={{ padding: '10px 14px' }}>
            Back
          </button>
        </div>
      </div>

      {/* Files */}
      <h3 id="files" style={{ marginTop: 32 }}>Files</h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => e.currentTarget.files?.[0] && uploadFile(e.currentTarget.files[0])}
        />
        {uploading && <span>Uploading…</span>}
      </div>

      {files.length === 0 ? (
        <p style={{ marginTop: 12, color: '#666' }}>No files yet.</p>
      ) : (
        <ul style={{ marginTop: 12, paddingLeft: 18 }}>
          {files.map(f => (
            <li key={f.id} style={{ marginBottom: 6 }}>
              <a href={f.url ?? '#'} target="_blank" rel="noreferrer" style={{ color: 'purple' }}>
                {f.name}
              </a>
              <span style={{ color: '#888', marginLeft: 8 }}>
                ({(f.size_bytes ?? 0).toLocaleString()} bytes)
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
