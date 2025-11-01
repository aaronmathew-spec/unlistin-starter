export const runtime = "nodejs";

import Link from "next/link";

export default function ThanksPage() {
  return (
    <main>
      <div className="hero">
        <div className="hero-card glass" style={{ textAlign: "center" }}>
          <h1 className="hero-title">Thanks — you’re in.</h1>
          <p className="sub">
            We’ve received your request. You’ll get an email with next steps and a secure link
            (short-lived) to review your request and sign the manifest.
          </p>

          <div className="row hero-ctas" style={{ justifyContent: "center" }}>
            <Link href="/" className="btn btn-lg">Back to Home</Link>
            <Link href="/ops/proofs/verify" className="btn btn-outline btn-lg">Verify a Bundle</Link>
          </div>

          <div className="hero-note">Questions? Reply to the email and we’ll help.</div>
        </div>
      </div>
    </main>
  );
}
