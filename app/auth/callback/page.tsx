// app/auth/callback/page.tsx
import { Suspense } from 'react';
import CallbackClient from './CallbackClient';

export const dynamic = 'force-dynamic'; // don't prerender
export const revalidate = 0;             // no caching

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <CallbackClient />
    </Suspense>
  );
}
