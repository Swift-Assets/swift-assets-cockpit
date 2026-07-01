import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Load Inter via next/font and expose it as --font-sans (consumed by Tailwind's
// font-sans and the globals.css token). Latin UI; the product copy is German.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Swift Assets · Cockpit",
  description: "Swift Assets V2 — Internal Cockpit. Internal use only.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
