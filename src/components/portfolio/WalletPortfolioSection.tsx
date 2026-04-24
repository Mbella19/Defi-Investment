"use client";

import { useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/wallet/config";
import { usePortfolio } from "@/hooks/usePortfolio";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { Eyebrow, Icons } from "@/components/sovereign";
import type { PortfolioSummary } from "@/types/wallet";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

const rkDark = darkTheme({
  accentColor: "#5AE4D4",
  accentColorForeground: "#07080C",
  borderRadius: "none",
  fontStack: "system",
});
rkDark.colors.modalBackground = "#0D1015";
rkDark.colors.modalBorder = "#1F2530";

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
      <div
        className="brackets"
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <Eyebrow>Wallet Required</Eyebrow>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: "var(--text-dim)",
              lineHeight: 1.5,
              maxWidth: 420,
            }}
          >
            Connect your wallet to pull balances from all 7 supported EVM chains.
          </p>
          <RainbowConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div
      className="brackets"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Eyebrow>Connected</Eyebrow>
          <div
            className="mono"
            style={{
              fontSize: 13,
              color: "var(--text)",
              marginTop: 8,
              letterSpacing: "0.03em",
            }}
          >
            {address}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={refetch}
            disabled={isLoading}
            className="mono"
            style={{
              padding: "10px 18px",
              background: isLoading ? "var(--surface-2)" : "var(--accent)",
              color: isLoading ? "var(--text-dim)" : "var(--bg)",
              border: `1px solid ${isLoading ? "var(--line)" : "var(--accent)"}`,
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icons.refresh />
            {isLoading ? "Loading…" : "Refresh"}
          </button>
          <RainbowConnectButton />
        </div>
      </div>
      {error && (
        <div
          style={{
            border: "1px solid var(--danger)",
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            padding: "12px 16px",
            color: "var(--danger)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
      {isLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {[0, 150, 300].map((d) => (
            <span
              key={d}
              style={{
                width: 6,
                height: 6,
                background: "var(--accent)",
                boxShadow: "0 0 8px var(--accent)",
                animation: `blink 1.2s ease-in-out ${d}ms infinite`,
              }}
            />
          ))}
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: "var(--text-dim)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Fetching balances across 7 chains…
          </span>
        </div>
      )}
    </div>
  );
}

export default function WalletPortfolioSection({ onPortfolioChange }: Props) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkDark}>
          <WalletInner onPortfolioChange={onPortfolioChange} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
