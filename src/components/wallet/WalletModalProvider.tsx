"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useAccount,
  useConnect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { Check, LogOut, WalletCards, X } from "lucide-react";
import { SUPPORTED_CHAINS } from "@/lib/wallet/config";

type WalletModal = "connect" | "account" | "chain" | null;

interface WalletModalContextValue {
  openConnectModal: () => void;
  openAccountModal: () => void;
  openChainModal: () => void;
}

const WalletModalContext = createContext<WalletModalContextValue | null>(null);

export function useWalletModal(): WalletModalContextValue {
  const context = useContext(WalletModalContext);
  if (!context) {
    throw new Error("useWalletModal must be used inside <WalletModalProvider>");
  }
  return context;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<WalletModal>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const { address, chainId, isConnected } = useAccount();
  const connectors = useConnectors();
  const { mutateAsync: connectAsync, isPending: isConnecting } = useConnect();
  const { mutateAsync: disconnectAsync, isPending: isDisconnecting } = useDisconnect();
  const { mutateAsync: switchChainAsync, isPending: isSwitching } = useSwitchChain();

  const open = useCallback((next: Exclude<WalletModal, null>) => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setActionError(null);
    setModal(next);
  }, []);

  const close = useCallback(() => {
    setModal(null);
    setActionError(null);
    requestAnimationFrame(() => restoreFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!modal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, modal]);

  const value = useMemo<WalletModalContextValue>(() => ({
    openConnectModal: () => open("connect"),
    openAccountModal: () => open(isConnected ? "account" : "connect"),
    openChainModal: () => open(isConnected ? "chain" : "connect"),
  }), [isConnected, open]);

  const connectWallet = async (connector: (typeof connectors)[number]) => {
    setActionError(null);
    try {
      await connectAsync({ connector });
      close();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Wallet connection failed");
    }
  };

  const switchNetwork = async (nextChainId: (typeof SUPPORTED_CHAINS)[number]["id"]) => {
    setActionError(null);
    try {
      await switchChainAsync({ chainId: nextChainId });
      close();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Network switch failed");
    }
  };

  const disconnectWallet = async () => {
    setActionError(null);
    try {
      await disconnectAsync();
      close();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Wallet disconnect failed");
    }
  };

  return (
    <WalletModalContext.Provider value={value}>
      {children}
      {modal ? (
        <div
          className="wallet-modal-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
        >
          <section
            className="wallet-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-modal-title"
          >
            <div className="wallet-modal-header">
              <div>
                <p className="eyebrow">Wallet access</p>
                <h2 id="wallet-modal-title">
                  {modal === "connect"
                    ? "Connect a wallet"
                    : modal === "chain"
                      ? "Choose a network"
                      : "Connected account"}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="wallet-modal-close"
                onClick={close}
                aria-label="Close wallet dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {modal === "connect" ? (
              <div className="wallet-modal-options">
                {connectors.length === 0 ? (
                  <p className="wallet-modal-note">
                    No compatible wallet was found. Install an EIP-1193 browser wallet or
                    configure WalletConnect.
                  </p>
                ) : (
                  connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      type="button"
                      className="wallet-modal-option"
                      disabled={isConnecting}
                      onClick={() => void connectWallet(connector)}
                    >
                      <WalletCards size={19} aria-hidden="true" />
                      <span>{connector.name}</span>
                    </button>
                  ))
                )}
              </div>
            ) : modal === "chain" ? (
              <div className="wallet-modal-options">
                {SUPPORTED_CHAINS.map((chain) => (
                  <button
                    key={chain.id}
                    type="button"
                    className="wallet-modal-option"
                    disabled={isSwitching || chain.id === chainId}
                    onClick={() => void switchNetwork(chain.id)}
                  >
                    <span>{chain.name}</span>
                    {chain.id === chainId ? <Check size={18} aria-label="Current network" /> : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="wallet-modal-account">
                <div className="wallet-modal-address">
                  <WalletCards size={20} aria-hidden="true" />
                  <div>
                    <strong>{address ? shortAddress(address) : "Wallet unavailable"}</strong>
                    <span>
                      {SUPPORTED_CHAINS.find((chain) => chain.id === chainId)?.name ??
                        "Unsupported network"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="wallet-modal-option"
                  onClick={() => open("chain")}
                >
                  Change network
                </button>
                <button
                  type="button"
                  className="wallet-modal-option wallet-modal-danger"
                  disabled={isDisconnecting}
                  onClick={() => void disconnectWallet()}
                >
                  <LogOut size={18} aria-hidden="true" />
                  <span>{isDisconnecting ? "Disconnecting…" : "Disconnect wallet"}</span>
                </button>
              </div>
            )}

            {actionError ? <p className="wallet-modal-error" role="alert">{actionError}</p> : null}
            <p className="wallet-modal-note">
              Connecting only proves wallet ownership. Sovereign never requests custody or token
              approvals.
            </p>
          </section>
        </div>
      ) : null}
    </WalletModalContext.Provider>
  );
}
