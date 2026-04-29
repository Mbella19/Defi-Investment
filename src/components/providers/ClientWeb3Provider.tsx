"use client";

import dynamic from "next/dynamic";

// RainbowKit's WalletConnect connectors hit `localStorage` synchronously —
// even with wagmi's `ssr: true` flag. So we keep the entire provider tree
// out of SSR and rely on a tiny shell flicker on first paint instead. This
// matches the architecture the rest of the app was already using.
const Web3Provider = dynamic(
  () => import("@/components/providers/Web3Provider"),
  { ssr: false },
);

export default function ClientWeb3Provider({ children }: { children: React.ReactNode }) {
  return <Web3Provider>{children}</Web3Provider>;
}
