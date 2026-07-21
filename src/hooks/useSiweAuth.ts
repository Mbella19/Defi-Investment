"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount, useChainId, useDisconnect, useSignMessage } from "wagmi";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useWalletModal } from "@/components/wallet/WalletModalProvider";

export type SiweAuthStatus =
  | "idle" // no wallet connected
  | "checking" // probing /api/auth/me on first mount
  | "needs-signature" // wallet connected but no matching session
  | "signing" // mid-flow (nonce → sign → verify)
  | "authed" // session cookie matches connected wallet
  | "error"; // last sign-in attempt failed

export type SignInResult =
  | { ok: true; wallet: string }
  | { ok: false; code: "WALLET_REQUIRED" | "SIGNATURE_REJECTED" | "AUTH_FAILED"; error: string };

interface SiweAuthValue {
  status: SiweAuthStatus;
  /** Lower-case 0x-address that the server has accepted, or null. */
  authedWallet: string | null;
  /** Last error message from a failed sign-in (cleared on retry). */
  error: string | null;
  /** Trigger the SIWE flow against the currently connected wallet. */
  signIn: () => Promise<SignInResult>;
  /** Clear the server session (and also disconnect the wagmi connection). */
  signOut: () => Promise<void>;
  /**
   * Re-probe /api/auth/me to sync provider state with the server cookie.
   * Useful after a side-channel sign-in (e.g. /dev/owner-login) where the
   * cookie was set without going through the SIWE flow.
   */
  refresh: () => Promise<void>;
}

const SiweAuthContext = createContext<SiweAuthValue | null>(null);

export function useSiweAuth(): SiweAuthValue {
  const ctx = useContext(SiweAuthContext);
  if (!ctx) throw new Error("useSiweAuth must be used inside <SiweAuthProvider>");
  return ctx;
}

function buildSiweMessage(params: {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
}): string {
  const issuedAt = new Date().toISOString();
  return [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    params.address,
    "",
    "Sign in to Sovereign Investment Group. This signature does not authorize any transactions.",
    "",
    `URI: ${params.uri}`,
    `Version: 1`,
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

export function SiweAuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useWalletModal();
  const pathname = usePathname();

  const [status, setStatus] = useState<SiweAuthStatus>("checking");
  const [authedWallet, setAuthedWallet] = useState<string | null>(null);
  const [sessionAuthMethod, setSessionAuthMethod] = useState<"siwe" | "dev" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const revokingRef = useRef(false);

  const signIn = useCallback(async (): Promise<SignInResult> => {
    if (!address || !isConnected) {
      const message = "Connect a wallet first";
      setError(message);
      setStatus("idle");
      openConnectModal();
      return { ok: false, code: "WALLET_REQUIRED", error: message };
    }
    setStatus("signing");
    setError(null);
    try {
      const nonceRes = await fetch("/api/auth/nonce", { cache: "no-store" });
      if (!nonceRes.ok) throw new Error(`nonce ${nonceRes.status}`);
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const message = buildSiweMessage({
        domain: window.location.host,
        address,
        uri: window.location.origin,
        chainId: chainId ?? 1,
        nonce,
      });

      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      if (!verifyRes.ok) {
        const err = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `verify ${verifyRes.status}`);
      }
      const data = (await verifyRes.json()) as { address: string };
      const wallet = data.address.toLowerCase();
      setAuthedWallet(wallet);
      setSessionAuthMethod("siwe");
      setStatus("authed");
      return { ok: true, wallet };
    } catch (err) {
      const message = err instanceof Error ? err.message : "sign-in failed";
      setError(message);
      setStatus("error");
      const rejected = /rejected|denied|cancel/i.test(message);
      return {
        ok: false,
        code: rejected ? "SIGNATURE_REJECTED" : "AUTH_FAILED",
        error: message,
      };
    }
  }, [address, isConnected, chainId, openConnectModal, signMessageAsync]);

  const probeSession = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as {
          address?: string | null;
          authMethod?: "siwe" | "dev" | null;
        };
        if (data.address) {
          setAuthedWallet(data.address.toLowerCase());
          setSessionAuthMethod(data.authMethod === "dev" ? "dev" : "siwe");
          setError(null);
          setStatus("authed");
          return;
        }
      }
    } catch {
      /* fall through */
    }
    setAuthedWallet(null);
    setSessionAuthMethod(null);
    setStatus(address ? "needs-signature" : "idle");
  }, [address]);

  // Probe existing session on mount (Set-Cookie may have survived a refresh).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void probeSession();
    });
    return () => {
      cancelled = true;
    };
  }, [probeSession]);

  // Reconcile session against the connected wallet whenever either changes.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || status === "checking" || status === "signing") return;
      // The explicitly credentialed localhost owner bypass exists so staff can
      // work without connecting a hardware wallet. It remains server-scoped
      // and is still blocked in production/Vercel.
      if (sessionAuthMethod === "dev" && authedWallet) {
        if (status !== "authed") setStatus("authed");
        return;
      }
      if (!isConnected || !address) {
        if (status !== "idle") {
          if (authedWallet && !revokingRef.current) {
            revokingRef.current = true;
            void apiFetch("/api/auth/logout", { method: "POST" }).finally(() => {
              revokingRef.current = false;
            });
          }
          setStatus("idle");
          setAuthedWallet(null);
          setSessionAuthMethod(null);
          setError(null);
        }
        return;
      }
      const lower = address.toLowerCase();
      if (authedWallet && authedWallet === lower) {
        if (status !== "authed") setStatus("authed");
        return;
      }
      if (authedWallet && authedWallet !== lower && !revokingRef.current) {
        revokingRef.current = true;
        void apiFetch("/api/auth/logout", { method: "POST" }).finally(() => {
          revokingRef.current = false;
        });
        setAuthedWallet(null);
        setSessionAuthMethod(null);
      }
      if (status !== "needs-signature" && status !== "error") {
        setStatus("needs-signature");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, authedWallet, sessionAuthMethod, status]);

  // Auto-prompt the SIWE flow once per wallet connection. We DON'T auto-retry
  // on error — let the user click the manual sign-in button after dismissing.
  // Suppressed on /dev/* routes — the dev-login page exists specifically to
  // bypass hardware signing, so a competing auto-prompt would defeat its purpose.
  const lastAutoSignedRef = useRef<string | null>(null);
  useEffect(() => {
    if (status !== "needs-signature") return;
    if (!address) return;
    if (pathname?.startsWith("/dev/")) return;
    const lower = address.toLowerCase();
    if (lastAutoSignedRef.current === lower) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || lastAutoSignedRef.current === lower) return;
      lastAutoSignedRef.current = lower;
      void signIn();
    });
    return () => {
      cancelled = true;
    };
  }, [status, address, pathname, signIn]);

  const signOut = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* server cookie clear is best-effort */
    }
    setAuthedWallet(null);
    setSessionAuthMethod(null);
    setStatus("idle");
    setError(null);
    disconnect();
  }, [disconnect]);

  const value: SiweAuthValue = {
    status,
    authedWallet,
    error,
    signIn,
    signOut,
    refresh: probeSession,
  };

  return createElement(SiweAuthContext.Provider, { value }, children);
}
