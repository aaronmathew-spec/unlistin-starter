# UnlistIN Starter (Next.js + Supabase OTP)

Minimal starter for email OTP auth using Supabase and Next.js App Router.
- Login page at `/` with magic-link OTP
- Post-login redirect to `/dashboard`
- Basic sign-out

## Quick Start (Local)

1. Copy `.env.example` to `.env.local` and fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Optionally `NEXT_PUBLIC_SITE_URL` (defaults to http://localhost:3000)

2. Install deps and run:
   ```bash
   npm i
   npm run dev
   ```

3. In Supabase -> Project Settings -> Auth -> URL Configuration:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: `http://localhost:3000/dashboard`

## Deploy to Vercel (Summary)
1. Push this folder to a new Git repo (GitHub).
2. In Vercel, import the repo and set Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-app>.vercel.app`
3. In Supabase -> Auth -> URL Configuration add your Vercel URLs:
   - **Site URL**: `https://<your-app>.vercel.app`
   - **Redirect URLs**: `https://<your-app>.vercel.app/dashboard`
4. Deploy. Test login via magic link.
