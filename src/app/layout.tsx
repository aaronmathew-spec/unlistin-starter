// src/app/layout.tsx
import "./globals.css";
import AppNav from "@/components/AppNav";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Add this */}
        <AppNav />
        {/* Existing content */}
        {children}
      </body>
    </html>
  );
}
