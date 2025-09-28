'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import supabase from '@/lib/supabaseClient'

type RequestRow = {
  id: number
  created_at: string
  category: string | null
  status: string | null
  notes: string | null
}

type FileRow = {
  id: number
  name: string | null
  size_bytes: number | null
  url: string | null // if you store urls; otherwise it will be null and we’ll just show the name
}

const STATUSES = ['new', 'queued', 'in_progress', 'done'] as const

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const requestId = Number(params?.id)
  const [row, setRow] = useState<RequestRow | null>(null)
  const [files, setFiles] = useState<FileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)

  // Load request + files
  useEffect(() => {
    let mounted = true
    if (!requestId) return

    ;(async () => {
      try {
        // require login
        const { data: auth } = await supabase.auth.getUser()
        if (!auth?.user) {
          router.push('/')
          return
        }

        const [{ data: req, error: reqErr }, { data: f, error: fileErr }] =
          await Promise.all([
            supabase
              .from('requests')
              .select('id, created_at, category, status, notes')
              .eq('id', requestId)
              .single(),
            supabase
              .from('request_files')
              .select('id, name, size_bytes, url')
              .eq('request_id', requestId)
              .order('id', { ascending: false }),
          ])

        if (reqErr) throw reqErr
        if (fileErr) throw fileErr
        if (!mounted) return

        setRow(req as RequestRow)
        setFiles((f ?? []) as FileRow[])
      } catch (e) {
        console.error(e)
        alert('Failed to load request.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [requestId, router])

  async function updateStatus(nextStatus: string) {
    if (!row) return
    try {
      setSavingStatus(true)
      const { error } = await supabase
        .from('requests')
        .update({ status: nextStatus })
        .eq('id', row.id)
      if (error) throw error
      setRow({ ...row, status: nextStatus })
    } catch (e) {
      console.error(e)
      alert('Could not update status')
    } finally {
      setSavingStatus(false)
    }
  }

  async function deleteFile(fileId: number, fileName: string | null) {
    if (!row) return
    if (!confirm(`Delete "${fileName ?? 'file'}"?`)) return

    try {
      const res = await fetch(`/api/requests/${row.id}/files/${fileId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Delete failed')

      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch (e: any) {
      console.error(e)
      alert(e.message || 'Delete failed')
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading…</div>
  }

  if (!row) {
    return <div style={{ padding: 24 }}>Not found.</div>
  }

  return (
    <div style={{ maxWidth: 960, margin: '40px auto', padding: 16 }}>
      {/* Top nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>UnlistIN</h1>
        <nav style={{ display: 'flex', gap: 16 }}>
          <a href="/" style={{ color: 'purple' }}>
            Home
          </a>
          <a href="/requests" style={{ color: 'purple' }}>
            Requests
          </a>
        </nav>
      </div>

      <h2 style={{ marginTop: 24 }}>Request #{row.id}</h2>

      {/* Status */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 6, color: '#555' }}>
          Status
        </label>
        <select
          value={row.status ?? 'new'}
          onChange={e => updateStatus(e.target.value)}
          disabled={savingStatus}
          style={{ padding: 8 }}
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {savingStatus && (
          <span style={{ marginLeft: 8, color: '#888' }}>Saving…</span>
        )}
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#777', marginBottom: 6 }}>Notes</div>
        <div
          style={{
            border: '1px solid #eee',
            borderRadius: 6,
            padding: 12,
            whiteSpace: 'pre-wrap',
            minHeight: 48,
          }}
        >
          {row.notes || '—'}
        </div>
      </div>

      {/* Files */}
      <h3 id="files" style={{ marginTop: 32 }}>
        Files
      </h3>
      {files.length === 0 ? (
        <p style={{ color: '#777' }}>No files uploaded.</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {files.map(f => (
            <li
              key={f.id}
              style={{
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer" style={{ color: 'purple' }}>
                  {f.name ?? '(file)'}
                </a>
              ) : (
                <span>{f.name ?? '(file)'}</span>
              )}
              <span style={{ color: '#888' }}>
                ({(f.size_bytes ?? 0).toLocaleString()} bytes)
              </span>

              <button
                onClick={() => deleteFile(f.id, f.name)}
                style={{ padding: '4px 8px' }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
