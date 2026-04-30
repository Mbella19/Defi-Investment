import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import ClientWeb3Provider from "@/components/providers/ClientWeb3Provider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sovereign — Institutional-grade DeFi yield, vetted",
  description:
    "Your bank pays 0.5%. DeFi pays 5–25%. Sovereign gets you there safely — vetted allocations, an institutional-grade security review on every protocol, and 24/7 monitoring. Non-custodial. Read-only. Wallet stays yours.",
  icons: {
    icon: "/icon.png",
  },
};

// Web3 + SIWE providers live at the root so the wagmi connection and the
// SIWE auto-sign ref persist across landing↔app navigation. If they re-mount
// per route group, the auto-sign throttle resets and MetaMask gets prompted
// again on every cross-group click.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${jetbrains.variable}`}>
        <ClientWeb3Provider>{children}</ClientWeb3Provider>
      </body>
    </html>
  );
}
