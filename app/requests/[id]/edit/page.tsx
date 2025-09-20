'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '../../lib/supabaseClient';

export default function EditRequest() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [siteUrl, setSiteUrl] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userResp } = await supabase.auth.getUser();
      if (!userResp.user) { window.location.href = '/'; return; }
      const { data, error } = await supabase.from('requests').select('*').eq('id', id).single();
      if (error) { alert(error.message); return; }
      setSiteUrl(data.site_url);
      setCategory(data.category ?? '');
      setNotes(data.notes ?? '');
      setLoading(false);
    })();
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('requests').update({
      site_url: siteUrl,
      category: category || null,
      notes: notes || null,
    }).eq('id', id);
    if (error) return alert(error.message);
    router.push('/requests');
  }

  if (loading) return <p>Loading…</p>;

  return (
    <main>
      <h2>Edit Request</h2>
      <form onSubmit={save} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
        <label>Site URL
          <input type="url" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} required
                 style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}/>
        </label>
        <label>Category
          <input value={category} onChange={(e) => setCategory(e.target.value)}
                 placeholder="Data Broker / People Search / …"
                 style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}/>
        </label>
        <label>Notes
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}/>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0 }}>Save</button>
          <button type="button" onClick={() => router.push('/requests')}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ccc' }}>Cancel</button>
        </div>
      </form>
    </main>
  );
}
