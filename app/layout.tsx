import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swift Assets · Cockpit",
  description: "Swift Assets V2 — Internal Cockpit. Internal use only.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
