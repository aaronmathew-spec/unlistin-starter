// app/admin/controls/page.tsx
import { isAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import ControlsClient from "./ControlsClient";

export const metadata = {
  title: "Admin Controls",
};

export default async function AdminControlsPage() {
  const ok = await isAdmin();
  if (!ok) return notFound();

  // Server renders shell; the client component fetches data and handles updates
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Admin Controls</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Toggle feature flags and tune adapter automation. Changes apply immediately to server logic.
      </p>

      <div className="mt-6">
        <ControlsClient />
      </div>
    </div>
  );
}
