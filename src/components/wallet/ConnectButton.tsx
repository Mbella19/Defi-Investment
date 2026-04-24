"use client";

import { WagmiProvider } from "wagmi";
import {
  RainbowKitProvider,
  ConnectButton as RainbowConnectButton,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/wallet/config";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

const rkDark = darkTheme({
  accentColor: "#5AE4D4",
  accentColorForeground: "#07080C",
  borderRadius: "none",
  fontStack: "system",
});
rkDark.colors.modalBackground = "#07080C";
rkDark.colors.modalBorder = "#2A313D";

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 14px",
  fontFamily: "var(--font-geist-mono), 'Geist Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  border: "1px solid var(--line-2)",
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
  transition: "all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
};

const accentPill: React.CSSProperties = {
  ...pill,
  color: "var(--accent)",
  borderColor: "color-mix(in oklch, var(--accent) 60%, transparent)",
  background: "var(--accent-soft)",
};

const dangerPill: React.CSSProperties = {
  ...pill,
  color: "var(--danger)",
  borderColor: "color-mix(in oklch, var(--danger) 60%, transparent)",
  background: "color-mix(in oklch, var(--danger) 10%, transparent)",
};

function ConnectButtonInner() {
  return (
    <RainbowConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button onClick={openConnectModal} style={accentPill}>
                    CONNECT WALLET
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button onClick={openChainModal} style={dangerPill}>
                    WRONG NETWORK
                  </button>
                );
              }

              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={openChainModal}
                    style={pill}
                    title="Switch network"
                  >
                    {chain.hasIcon && chain.iconUrl ? (
                      <img
                        alt={chain.name ?? "Chain"}
                        src={chain.iconUrl}
                        style={{ width: 14, height: 14 }}
                      />
                    ) : null}
                    <span>{chain.name}</span>
                  </button>
                  <button onClick={openAccountModal} style={accentPill}>
                    {account.displayName}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}

export default function ConnectButton() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkDark}>
          <ConnectButtonInner />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
