'use client';

import { useParams } from 'next/navigation';

export default function RequestFilesPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <nav style={{ marginBottom: 16 }}>
        <a href="/requests" style={{ color: '#5b21b6' }}>
          ← Back to Requests
        </a>
      </nav>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        Files for Request #{id}
      </h1>

      <p style={{ lineHeight: 1.6 }}>
        This is a placeholder page so the Files button works.
        We’ll wire up listing & uploads (Supabase Storage or a
        <code>request_files</code> table) in a later step.
      </p>
    </div>
  );
}
