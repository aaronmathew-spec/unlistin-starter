// app/ops/authz/new/submit/route.ts
// Form POST → calls createAuthorization() directly, then redirects to the viewer page.

import { NextResponse } from "next/server";
import { createAuthorization } from "@/src/lib/authz/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const fullName = String(form.get("fullName") || "");
    const subjectId = String(form.get("subjectId") || "") || null;
    const email = String(form.get("email") || "") || null;
    const phone = String(form.get("phone") || "") || null;
    const region = (String(form.get("region") || "IN") || "IN").toUpperCase();

    const signerName = String(form.get("signerName") || "");
    const signedAt = String(form.get("signedAt") || "");
    const consentText = String(form.get("consentText") || "");

    // Optional URLs – we won’t upload files here (keeps flow server-only & simple)
    const loaUrl = String(form.get("loaUrl") || "") || null;
    const idUrl = String(form.get("idUrl") || "") || null;

    if (!fullName || !signerName || !signedAt || !consentText) {
      return NextResponse.json(
        { ok: false, error: "missing_required_fields" },
        { status: 400 }
      );
    }

    // Create without artifacts (files optional). You can attach later if needed.
    const res = await createAuthorization({
      subject: { subjectId, fullName, email, phone, region },
      signerName,
      signedAt,
      consentText,
      artifacts: [], // keep empty here; we didn’t upload any binary files
    });

    // Optional: if you provided evidence URLs, store them as separate files later.
    // (For now we just create the record; the manifest hash is already set.)

    // Redirect to the detail page
    return NextResponse.redirect(new URL(`/ops/authz/${res.record.id}`, req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
