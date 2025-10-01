// app/scan/quick/page.tsx
// Server component wrapper (no "use client")
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Client from "./Client";

export default function QuickScanPage() {
  return <Client />;
}
