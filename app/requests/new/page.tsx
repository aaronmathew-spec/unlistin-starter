'use client';
import { useState, useEffect } from 'react';
// note the relative path (three levels up from this file)
import { supabase } from '../../../lib/supabaseClient';

export default function NewRequestPage() {
  const [siteUrl, setSiteUrl] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // require login
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/';
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: userResp } = await supabase.auth.getUser();
    const user = userResp.user;
    if (!user) return (window.location.href = '/');

    const { error } = await supabase.from('requests').insert({
      user_id: user.id,
      site_url: siteUrl,
      category: category || null,
      status: 'new',
      notes: notes || null,
    });

    setLoading(false);
    if (error) alert(error.message);
    else window.location.href = '/requests'; // list page we'll add next
  }

  return (
    <main>
      <h2>New Removal Request</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
        <label>
          Site URL *
          <input
            required
            type="url"
            placeholder="https://example.com/profile/123"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </label>

        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
          >
            <option value="">— Select —</option>
            <option>Data Broker</option>
            <option>People Search</option>
            <option>Marketing List</option>
            <option>Social</option>
            <option>Other</option>
          </select>
        </label>

        <label>
          Notes
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything specific to track for this takedown"
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </label>

        <button type="submit" disabled={loading} style={{ padding: '10px 14px', borderRadius: 8, border: 0 }}>
          {loading ? 'Saving…' : 'Create Request'}
        </button>
      </form>
    </main>
  );
}
