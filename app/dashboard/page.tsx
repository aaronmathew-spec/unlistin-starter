// app/dashboard/page.tsx
import { getServerSupabase } from '@/lib/supabaseServer';

export default async function Dashboard() {
  const supabase = getServerSupabase();

  const { data: leads, error } = await supabase
    .from('people')
    .select('id, org_id, full_name, email, city_state, created_at')
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) {
    return <pre className="p-4 text-red-600">Error: {error.message}</pre>;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Latest Leads</h1>
      <p className="text-sm text-gray-500 mt-1">Most recent 25</p>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">City/State</th>
              <th className="px-3 py-2 text-left">Org</th>
              <th className="px-3 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.full_name ?? '—'}</td>
                <td className="px-3 py-2">{r.email ?? '—'}</td>
                <td className="px-3 py-2">{r.city_state ?? '—'}</td>
                <td className="px-3 py-2">{r.org_id ? 'Assigned' : 'Unassigned'}</td>
                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
