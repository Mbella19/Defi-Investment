"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletCards } from "lucide-react";

/**
 * Prototype's "Connect Wallet" pill, but wired to RainbowKit. When connected
 * the pill flips to the truncated address, clicking opens the account modal
 * (which is also where the user disconnects).
 */
export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        const handle = !connected
          ? openConnectModal
          : chain.unsupported
            ? openChainModal
            : openAccountModal;
        const label = !connected
          ? "Connect Wallet"
          : chain.unsupported
            ? "Wrong Network"
            : account.displayName;
        return (
          <button
            type="button"
            className="wallet-button"
            onClick={handle}
            aria-label={label}
            style={!ready ? { opacity: 0, pointerEvents: "none" } : undefined}
          >
            <WalletCards size={17} aria-hidden="true" />
            {label}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
