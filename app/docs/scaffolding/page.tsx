export const metadata = { title: "Scaffolding" };

export default function ScaffoldingPage() {
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Scaffolding</h1>

      <p className="text-gray-700 mt-3">Create a new feature slice from templates:</p>

      <pre className="mt-3 border rounded-lg p-3 overflow-auto text-sm bg-gray-50">
        <code>{`npm run generate coverage -- --kind=all
# creates:
# - app/api/coverage/route.ts
# - app/coverage/page.tsx
# - supabase/migrations/<timestamp>_coverage.sql
# - agents/coverage.ts`}</code>
      </pre>

      <p className="text-gray-700 mt-4">Generate specific kinds:</p>
      <ul className="list-disc ml-6 mt-2 space-y-1">
        <li><code>--kind=api</code></li>
        <li><code>--kind=page</code></li>
        <li><code>--kind=sql</code></li>
        <li><code>--kind=agent</code></li>
      </ul>
    </div>
  );
}
