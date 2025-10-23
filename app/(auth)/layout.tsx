// app/(auth)/layout.tsx
import "../globals.css";
import "../design-system.css";

export const metadata = {
  title: "Login · Unlistin",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen grid place-items-center bg-[color:var(--bg)] text-[color:var(--fg)]">
        {/* Soft aura */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_-10%,rgba(99,102,241,.12),rgba(255,255,255,0))]" />
        </div>
        {children}
      </body>
    </html>
  );
}
