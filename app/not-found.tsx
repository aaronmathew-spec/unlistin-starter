// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full border rounded-xl p-6 space-y-3 text-center">
        <h1 className="text-lg font-semibold">Not found</h1>
        <p className="text-sm text-gray-700">
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <div>
          <Link href="/" className="px-3 py-2 rounded border hover:bg-gray-50 inline-block">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
