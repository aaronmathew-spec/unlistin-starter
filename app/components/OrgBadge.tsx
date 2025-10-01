// app/components/OrgBadge.tsx
"use client";

import { useEffect, useState } from "react";

type Org = { id: string; name: string };

export default function OrgBadge() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me/organizations", { cache: "no-store" });
        const j = await res.json();
        if (!j.ok) setErr(j.error || "Failed");
        else setOrgs(j.orgs || []);
      } catch {
        setErr("Failed");
      }
    })();
  }, []);

  if (err) return null;
  if (orgs.length === 0) return null;

  const label = orgs[0]?.name || "Org";

  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-gray-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
      {label}
      {orgs.length > 1 && <span className="text-gray-400">(+{orgs.length - 1})</span>}
    </span>
  );
}
