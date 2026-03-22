import type { Metadata } from "next";
import { Newsreader, Inter } from "next/font/google";
import NavRail from "@/components/layout/NavRail";
import Header from "@/components/layout/Header";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["200", "300", "400", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sovereign Terminal | DeFi Intelligence",
  description:
    "Institutional-grade DeFi yield analysis powered by AI. Deep research on protocols, risk-adjusted yield scanning, and intelligent investment allocation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${newsreader.variable} ${inter.variable} bg-background text-on-surface font-body overflow-x-hidden selection:bg-primary selection:text-on-primary`}
      >
        <div className="grainy-bg fixed inset-0 z-[100]" />
        <NavRail />
        <Header />
        <main className="ml-20 pt-14 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
