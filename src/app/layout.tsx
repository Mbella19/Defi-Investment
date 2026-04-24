import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Sovereign · Orbital Intelligence Terminal",
  description:
    "Institutional-grade DeFi yield intelligence. Deep research on protocols, risk-adjusted yield scanning, and sovereign investment allocation — powered by Claude Opus 4.7.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fraunces.variable} ${geistMono.variable} ${inter.variable} noise`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
