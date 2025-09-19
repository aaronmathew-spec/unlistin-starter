'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Dashboard() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userEmail = data.user?.email ?? null;
      setEmail(userEmail);
      setLoading(false);
      if (!userEmail) window.location.href = '/';
    });
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <main>
      <h2>Dashboard</h2>
      <p>Welcome {email}</p>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.href = '/';
        }}
        style={{ padding: '8px 12px', borderRadius: 8, border: 0 }}
      >
        Sign out
      </button>
    </main>
  );
}
