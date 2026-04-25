"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 14px",
  fontFamily: "var(--font-geist-mono), 'Geist Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "var(--surface-2)",
  color: "var(--text)",
  cursor: "pointer",
  transition: "all 0.18s ease",
};

const accentPill: React.CSSProperties = {
  ...pill,
  color: "var(--accent-ink)",
  borderColor: "var(--accent)",
  background: "var(--accent)",
};

const dangerPill: React.CSSProperties = {
  ...pill,
  color: "var(--danger)",
  borderColor: "color-mix(in oklch, var(--danger) 60%, transparent)",
  background: "color-mix(in oklch, var(--danger) 12%, transparent)",
};

export default function ConnectButton() {
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
                  <button onClick={openConnectModal} style={accentPill} type="button">
                    CONNECT WALLET
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button onClick={openChainModal} style={dangerPill} type="button">
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
                    type="button"
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
                  <button onClick={openAccountModal} style={accentPill} type="button">
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
