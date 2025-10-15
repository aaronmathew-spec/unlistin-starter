// env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE: string;
    ADMIN_EMAILS?: string;

    // Optional but recommended
    SECURE_CRON_SECRET?: string;

    // Email provider (Resend)
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;       // e.g. "Unlistin <no-reply@yourdomain.com>"
    EMAIL_REPLY_TO?: string;   // e.g. "support@yourdomain.com"
  }
}
