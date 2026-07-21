"use client";

import { WalletCards } from "lucide-react";
import { useAccount } from "wagmi";
import { useWalletModal } from "@/components/wallet/WalletModalProvider";
import { SUPPORTED_CHAINS } from "@/lib/wallet/config";

/**
 * The top-nav wallet control. Account and network actions stay in the local
 * wallet dialog so the application does not depend on a third-party UI kit.
 */
export function WalletButton() {
  const { address, chainId, isConnected, status } = useAccount();
  const { openAccountModal, openChainModal, openConnectModal } = useWalletModal();
  const mounted = status !== "reconnecting";
  const unsupported = isConnected && !SUPPORTED_CHAINS.some((chain) => chain.id === chainId);
  const label = !isConnected || !address
    ? "Connect Wallet"
    : unsupported
      ? "Wrong Network"
      : `${address.slice(0, 6)}…${address.slice(-4)}`;
  const handleClick = !isConnected
    ? openConnectModal
    : unsupported
      ? openChainModal
      : openAccountModal;

  return (
    <button
      type="button"
      className="wallet-button"
      onClick={handleClick}
      aria-label={label}
      style={!mounted ? { opacity: 0, pointerEvents: "none" } : undefined}
    >
      <WalletCards size={17} aria-hidden="true" />
      {label}
    </button>
  );
}
