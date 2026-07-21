"use client";

import dynamic from "next/dynamic";

// Wallet connectors depend on browser-only provider discovery, so keep the
// connection tree outside SSR while the rest of the application remains
// server rendered.
const Web3Provider = dynamic(
  () => import("@/components/providers/Web3Provider"),
  { ssr: false },
);

export default function ClientWeb3Provider({ children }: { children: React.ReactNode }) {
  return <Web3Provider>{children}</Web3Provider>;
}
