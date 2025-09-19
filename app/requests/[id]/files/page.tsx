'use client';
import { useEffect, useState } from 'react';
// four levels up from /app/requests/[id]/files/page.tsx -> /lib/supabaseClient
import { supabase } from '../../../../lib/supabaseClient';
import { useParams } from 'next/navigation';

export default function FilesPage() {
  const { id } = useParams<{ id: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [objects, setObjects] = useState<{ name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { window.location.href = '/'; return; }
      setUserId(u.user.id);
      await list(u.user.id);
    })();
  }, [id]);

  async function list(uid: string) {
    const path = `${uid}/${id}`;
    const { data, error } = await supabase.storage.from('request-files').list(path, { limit: 100 });
    if (error) console.error(error);
    setObjects(data || []);
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!userId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const path = `${userId}/${id}/${file.name}`;
    const { error } = await supabase.storage.from('request-files').upload(path, file, { upsert: true });
    if (error) return alert(error.message);
    await list(userId);
    e.target.value = '';
  }

  async function remove(name: string) {
    if (!userId) return;
    const path = `${userId}/${id}/${name}`;
    const { error } = await supabase.storage.from('request-files').remove([path]);
    if (error) return alert(error.message);
    await list(userId);
  }

  return (
    <main>
      <h2>Files for request {id}</h2>
      <input type="file" onChange={upload} />
      <ul>
        {objects.map((o) => (
          <li key={o.name} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>{o.name}</span>
            <button onClick={() => remove(o.name)}>Delete</button>
          </li>
        ))}
      </ul>
      <a href="/requests">Back to Requests</a>
    </main>
  );
}
