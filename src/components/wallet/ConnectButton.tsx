"use client";

import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, ConnectButton as RainbowConnectButton, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/wallet/config";
import { useTheme } from "@/components/ThemeProvider";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

const rkLight = lightTheme({ accentColor: "#00D4AA", accentColorForeground: "#00110D", borderRadius: "none", fontStack: "system" });
const rkDark = darkTheme({ accentColor: "#00D4AA", accentColorForeground: "#00110D", borderRadius: "none", fontStack: "system" });
rkDark.colors.modalBackground = "#0a0a0b";
rkDark.colors.modalBorder = "#2a2a32";

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
                  <button
                    onClick={openConnectModal}
                    className="border border-accent text-accent px-4 py-2 text-sm font-semibold uppercase tracking-[0.04em] transition-all hover:-translate-y-0.5 hover:bg-accent hover:text-white"
                  >
                    Connect
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="border border-danger text-danger px-4 py-2 text-sm font-semibold uppercase tracking-[0.04em]"
                  >
                    Wrong Network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-1.5 border border-outline px-3 py-2 text-xs font-semibold text-on-surface-variant hover:border-accent/30 transition-all"
                    title="Switch network"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        alt={chain.name ?? "Chain"}
                        src={chain.iconUrl}
                        className="w-4 h-4"
                      />
                    )}
                    <span className="hidden sm:inline">{chain.name}</span>
                  </button>
                  <button
                    onClick={openAccountModal}
                    className="border border-accent/50 text-accent px-4 py-2 text-sm font-semibold tracking-[-0.02em] hover:bg-accent/10 transition-all"
                  >
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
  const { theme } = useTheme();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme === "dark" ? rkDark : rkLight}>
          <ConnectButtonInner />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
