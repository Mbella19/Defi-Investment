"use client";

import { useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/wallet/config";
import { useTheme } from "@/components/ThemeProvider";
import { usePortfolio } from "@/hooks/usePortfolio";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import type { PortfolioSummary } from "@/types/wallet";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

const rkLight = lightTheme({ accentColor: "#00D4AA", accentColorForeground: "#00110D", borderRadius: "none", fontStack: "system" });
const rkDark = darkTheme({ accentColor: "#00D4AA", accentColorForeground: "#00110D", borderRadius: "none", fontStack: "system" });
rkDark.colors.modalBackground = "#0a0a0b";
rkDark.colors.modalBorder = "#2a2a32";

interface Props {
  onPortfolioChange: (p: PortfolioSummary | null) => void;
}

function WalletInner({ onPortfolioChange }: Props) {
  const { address, isConnected, portfolio, isLoading, error, refetch } = usePortfolio();

  useEffect(() => {
    onPortfolioChange(portfolio);
  }, [portfolio, onPortfolioChange]);

  if (!isConnected) {
    return (
      <div className="bg-surface-low border border-outline p-4 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-on-surface-variant">
          Connect your wallet to view your portfolio.
        </p>
        <RainbowConnectButton />
      </div>
    );
  }

  return (
    <div className="bg-surface-low border border-outline p-4 sm:p-8 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-1">
            Connected
          </span>
          <span className="font-mono text-sm text-on-surface">{address}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refetch}
            disabled={isLoading}
            className="px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] bg-cta text-white hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
          <RainbowConnectButton />
        </div>
      </div>
      {error && (
        <div className="bg-danger/10 border border-danger/30 p-3">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}
      {isLoading && (
        <div className="flex items-center gap-3 py-4">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-accent animate-pulse" />
            <div className="w-2 h-2 bg-accent animate-pulse [animation-delay:150ms]" />
            <div className="w-2 h-2 bg-accent animate-pulse [animation-delay:300ms]" />
          </div>
          <p className="text-sm text-on-surface-variant">Fetching balances across 7 chains...</p>
        </div>
      )}
    </div>
  );
}

export default function WalletPortfolioSection({ onPortfolioChange }: Props) {
  const { theme } = useTheme();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme === "dark" ? rkDark : rkLight}>
          <WalletInner onPortfolioChange={onPortfolioChange} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
