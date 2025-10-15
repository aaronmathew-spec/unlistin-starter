// lib/system/health.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

export type StatusCheck = {
  name: string;
  ok: boolean;
  details?: Record<string, any>;
  hint?: string;
};

export type SystemStatus = {
  ok: boolean;
  checks: StatusCheck[];
};

function bool(v?: string | null) {
  return (v || "").toLowerCase() === "true";
}

export function gatherSystemStatus(): SystemStatus {
  // Read envs without throwing
  const ENV = (k: string) => process.env[k] || "";

  const checks: StatusCheck[] = [];

  // Supabase
  checks.push({
    name: "supabase.env",
    ok: !!ENV("NEXT_PUBLIC_SUPABASE_URL") && !!ENV("SUPABASE_SERVICE_ROLE"),
    details: {
      NEXT_PUBLIC_SUPABASE_URL: !!ENV("NEXT_PUBLIC_SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE: !!ENV("SUPABASE_SERVICE_ROLE"),
    },
    hint: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE in Vercel.",
  });

  // Admins
  const admins = (ENV("ADMIN_EMAILS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  checks.push({
    name: "admins.present",
    ok: admins.length > 0,
    details: { count: admins.length },
    hint: "Set ADMIN_EMAILS (comma-separated).",
  });

  // Secure Cron
  checks.push({
    name: "secure_cron.present",
    ok: !!ENV("SECURE_CRON_SECRET"),
    hint: "Set SECURE_CRON_SECRET; required by /api/ops/* secured endpoints.",
  });

  // Email
  const emailDryRun = bool(ENV("EMAIL_DRY_RUN"));
  const emailFrom = ENV("EMAIL_FROM");
  const resendKey = ENV("RESEND_API_KEY");
  checks.push({
    name: "email.config",
    ok: !!emailFrom && (!!resendKey || emailDryRun),
    details: {
      EMAIL_FROM: !!emailFrom,
      RESEND_API_KEY: !!resendKey,
      EMAIL_DRY_RUN: emailDryRun,
    },
    hint:
      "Set EMAIL_FROM and RESEND_API_KEY for live sending. Set EMAIL_DRY_RUN=true in non-prod.",
  });

  // Signing
  const backend = ENV("SIGNING_BACKEND") || "local-ed25519";
  checks.push({
    name: "signing.backend",
    ok:
      (backend === "local-ed25519" && !!ENV("SIGNING_PRIVATE_KEY_PEM")) ||
      (backend === "aws-kms" && !!ENV("AWS_REGION") && !!ENV("AWS_KMS_KEY_ID")),
    details: {
      SIGNING_BACKEND: backend,
      SIGNING_PRIVATE_KEY_PEM: !!ENV("SIGNING_PRIVATE_KEY_PEM"),
      AWS_REGION: !!ENV("AWS_REGION"),
      AWS_KMS_KEY_ID: !!ENV("AWS_KMS_KEY_ID"),
    },
    hint:
      backend === "aws-kms"
        ? "Ensure AWS_REGION and AWS_KMS_KEY_ID are set; add minimal kms:Sign."
        : "For dev, set SIGNING_PRIVATE_KEY_PEM. For prod, plan aws-kms cutover.",
  });

  // Cron targets (presence hint only; can’t query Vercel cron from here)
  checks.push({
    name: "cron.targets",
    ok: true,
    details: {
      workerPulse: "/api/ops/webform/worker (every 10m, header x-secure-cron)",
      verifyRecheck: "/api/ops/verify/recheck (every 6h, header x-secure-cron)",
      verifyAlert: "/api/ops/verify/alert (every 6h, header x-secure-cron)",
      slaAlert: "/api/ops/sla/alert (e.g., hourly, header x-secure-cron)",
    },
    hint: "Add these as Vercel Cron jobs in Project → Settings → Cron Jobs.",
  });

  const ok = checks.every((c) => c.ok);
  return { ok, checks };
}
