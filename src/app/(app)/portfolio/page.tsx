"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePastedWallet } from "@/hooks/usePastedWallet";
import AddressInput from "@/components/wallet/AddressInput";
import TokenList from "@/components/portfolio/TokenList";
import ChainBreakdown from "@/components/portfolio/ChainBreakdown";
import { formatCurrency } from "@/lib/formatters";
import type { PortfolioSummary } from "@/types/wallet";

// Lazy-load the wallet-connected section (pulls in wagmi/RainbowKit only when needed)
const WalletPortfolioSection = dynamic(
  () => import("@/components/portfolio/WalletPortfolioSection"),
  {
    ssr: false,
    loading: () => (
      <div className="bg-surface-low border border-outline p-4 sm:p-8">
        <p className="text-sm text-muted">Loading wallet connection...</p>
      </div>
    ),
  }
);

export default function PortfolioPage() {
  const pasted = usePastedWallet();
  const [mode, setMode] = useState<"wallet" | "paste">("paste");
  const [walletPortfolio, setWalletPortfolio] = useState<PortfolioSummary | null>(null);

  // Use wallet data when in wallet mode, otherwise pasted
  const activePortfolio: PortfolioSummary | null =
    mode === "wallet" ? walletPortfolio : pasted.portfolio;
  const activeLoading = mode === "wallet" ? false : pasted.isLoading;
  const activeError = mode === "wallet" ? null : pasted.error;

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-14 lg:px-10 space-y-8">
      {/* Hero */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 bg-accent" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70">
            Wallet Portfolio
          </span>
        </div>
        <h1 className="text-3xl sm:text-[42px] font-black leading-[0.95] tracking-[-0.04em] text-on-surface">
          Portfolio<br />
          <span className="italic font-light text-accent">Tracker.</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm sm:text-base text-on-surface-variant leading-relaxed">
          Track real token balances across 7 EVM chains. Connect your wallet or paste any address.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-0">
        <button
          onClick={() => setMode("paste")}
          className={`px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] border transition-colors ${
            mode === "paste"
              ? "bg-accent text-white border-accent"
              : "bg-surface-low text-label/70 border-outline hover:text-on-surface"
          }`}
        >
          Paste Address
        </button>
        <button
          onClick={() => setMode("wallet")}
          className={`px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] border-y border-r transition-colors ${
            mode === "wallet"
              ? "bg-accent text-white border-accent"
              : "bg-surface-low text-label/70 border-outline hover:text-on-surface"
          }`}
        >
          Connect Wallet
        </button>
      </div>

      {/* Input Area */}
      {mode === "paste" ? (
        <AddressInput
          value={pasted.address}
          onChange={pasted.setAddress}
          onSubmit={() => pasted.fetchPortfolio()}
          isLoading={pasted.isLoading}
          isValid={pasted.isValidAddress}
        />
      ) : (
        <WalletPortfolioSection onPortfolioChange={setWalletPortfolio} />
      )}

      {/* Error */}
      {activeError && (
        <div className="bg-danger/10 border border-danger/30 p-4">
          <p className="text-sm text-danger font-medium">{activeError}</p>
        </div>
      )}

      {/* Loading */}
      {activeLoading && (
        <div className="bg-surface-low border border-outline p-8 sm:p-12 flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-accent animate-pulse" />
            <div className="w-2 h-2 bg-accent animate-pulse [animation-delay:150ms]" />
            <div className="w-2 h-2 bg-accent animate-pulse [animation-delay:300ms]" />
          </div>
          <p className="text-sm text-on-surface-variant">
            Fetching balances across 7 chains...
          </p>
        </div>
      )}

      {/* Portfolio Data */}
      {activePortfolio && !activeLoading && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-surface-low border border-outline p-4 sm:p-6">
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">
                Total Value
              </span>
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">
                {formatCurrency(activePortfolio.totalValueUsd)}
              </span>
            </div>
            <div className="bg-surface-low border border-outline p-4 sm:p-6">
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">
                Tokens
              </span>
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">
                {activePortfolio.tokenCount}
              </span>
            </div>
            <div className="bg-surface-low border border-outline p-4 sm:p-6">
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">
                Chains
              </span>
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface">
                {activePortfolio.chainCount}
              </span>
            </div>
            <div className="bg-surface-low border border-outline p-4 sm:p-6">
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-label/70 block mb-2">
                Address
              </span>
              <span className="text-sm font-mono text-on-surface-variant truncate block">
                {activePortfolio.address.slice(0, 6)}...{activePortfolio.address.slice(-4)}
              </span>
            </div>
          </div>

          {/* Warnings */}
          {activePortfolio.errors.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-4">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-1">
                Some chains had issues:
              </p>
              {activePortfolio.errors.map((err, i) => (
                <p key={i} className="text-xs text-yellow-600/80 dark:text-yellow-400/80">{err}</p>
              ))}
            </div>
          )}

          {/* Token List */}
          <TokenList tokens={activePortfolio.tokens} />

          {/* Chain Breakdown */}
          <ChainBreakdown chains={activePortfolio.chainBreakdown} />
        </>
      )}

      {/* Empty State */}
      {!activePortfolio && !activeLoading && !activeError && mode === "paste" && (
        <div className="bg-surface-low border border-outline p-8 sm:p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-muted mb-3 block">
            account_balance_wallet
          </span>
          <p className="text-sm text-on-surface-variant">
            Paste a wallet address above to view its portfolio.
          </p>
        </div>
      )}
    </div>
  );
}
