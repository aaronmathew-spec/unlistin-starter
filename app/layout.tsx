import "./globals.css";
import type { Metadata } from "next";
import { ToastProvider } from "@/app/components/Toast";

export const metadata: Metadata = {
  title: "UnlistIN",
  description: "UnlistIN Starter",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
