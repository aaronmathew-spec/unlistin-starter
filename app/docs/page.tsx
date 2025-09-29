export const metadata = { title: "Docs" };

export default function DocsIndexPage() {
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Project Docs</h1>
      <p className="text-gray-600 mt-3">
        This docs section ships with the app.
      </p>
      <ul className="list-disc ml-6 mt-3 space-y-1">
        <li>
          <code>npm run generate &lt;slice&gt; -- --kind=all</code> – scaffolds a
          feature slice.
        </li>
        <li>CI runs typecheck, lint, tests, and build on every push/PR.</li>
        <li>Conventions: Strict TS, RLS + signed URLs, activity logging.</li>
      </ul>
      <p className="mt-4">
        See also: <a className="underline" href="/docs/scaffolding">Scaffolding guide</a>.
      </p>
    </div>
  );
}
