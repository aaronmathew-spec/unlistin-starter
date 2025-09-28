// app/requests/new/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

export default async function NewRequestPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login'); // send them to magic-link page
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 16 }}>
      <h1>New Removal Request</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget as HTMLFormElement);
          const payload = {
            site_url: fd.get('site_url'),
            category: fd.get('category'),
            notes: fd.get('notes'),
          };

          const res = await fetch('/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // same-origin cookies are sent by default, but this is harmless and explicit:
            credentials: 'include',
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const { error } = await res.json();
            alert(error || 'Failed to create request');
            return;
          }
          window.location.href = '/requests';
        }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Site URL *</span>
          <input name="site_url" required placeholder="https://www.example.com" />
        </label>

        <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
          <span>Category</span>
          <select name="category" defaultValue="Search Engine">
            <option>Search Engine</option>
            <option>News/Media</option>
            <option>Social Network</option>
            <option>Aggregator</option>
            <option>Other</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
          <span>Notes</span>
          <textarea name="notes" rows={4} placeholder="Details to help us remove the content" />
        </label>

        <button type="submit" style={{ marginTop: 16 }}>Save</button>
      </form>
    </div>
  );
}
