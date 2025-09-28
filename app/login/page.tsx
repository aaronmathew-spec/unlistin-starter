"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function send() {
    const supabase = getBrowserSupabase();
    const origin = window.location.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`
      }
    });

    if (error) alert(error.message);
    else setSent(true);
  }

  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: 16 }}>
      <h1>Sign in</h1>
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />
      <button onClick={send}>Send magic link</button>
      {sent && <p>Check your email for the magic link.</p>}
    </div>
  );
}
