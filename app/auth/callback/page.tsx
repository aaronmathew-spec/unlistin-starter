"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function AuthCallback() {
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    (async () => {
      try {
        // 1) Build a browser Supabase client (anon key)
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // 2) Get current user from the session
        const { data: uData, error: uErr } = await supabase.auth.getUser();
        if (uErr || !uData?.user) {
          setMsg("No user session found. Redirecting to login…");
          window.location.href = "/login";
          return;
        }

        const user = uData.user;
        const full_name =
          // Supabase social providers often provide name in user_metadata
          (user.user_metadata?.name as string | undefined) ||
          (user.user_metadata?.full_name as string | undefined) ||
          user.email?.split("@")[0] ||
          "Personal";

        // 3) Ensure they have a personal org + set org cookie
        const res = await fetch("/api/org/ensure-personal", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            full_name,
            email: user.email,
          }),
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          console.warn("ensure-personal failed:", j?.error || res.status);
          // Not fatal—RLS will still block until org is chosen
        }

        // 4) Done → land them on dashboard (or anywhere)
        setMsg("All set. Redirecting…");
        window.location.href = "/dashboard";
      } catch (e: any) {
        console.error(e);
        setMsg("Something went wrong. Redirecting to login…");
        window.location.href = "/login";
      }
    })();
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-sm text-gray-600">{msg}</div>
    </div>
  );
}
