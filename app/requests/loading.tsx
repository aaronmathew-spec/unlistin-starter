export default function LoadingRequests() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="h-32 bg-gray-100 rounded animate-pulse" />
      <div className="h-64 bg-gray-100 rounded animate-pulse" />
    </div>
  );
}
