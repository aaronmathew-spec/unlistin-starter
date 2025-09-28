import LeadForm from '../components/LeadForm'

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">UnlistIN</h1>
      <p className="mt-2 text-gray-600">
        Instantly scan the web and queue removals from one place.
      </p>
      <LeadForm />
    </main>
  )
}
