"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  useAccount,
  useBalance,
  useChainId,
  useEstimateFeesPerGas,
  useEstimateGas,
  useReadContract,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { encodeFunctionData, erc20Abi, formatUnits, type Hex } from "viem";
import { CommandStrip } from "@/components/site/ui";
import { useSiweAuth } from "@/hooks/useSiweAuth";
import { usePlan } from "@/hooks/usePlan";
import { apiFetch } from "@/lib/api-client";

interface SupportedPair {
  chain: string;
  token: string;
  label: string;
  chainLabel: string;
  decimals: number;
  chainId: number;
  isEvm: boolean;
  contract: string | null;
  enabled: boolean;
}

interface Quote {
  id: string;
  wallet: string;
  tier: "pro" | "ultra";
  chain: string;
  token: string;
  recipientAddress: string;
  amountUsd: number;
  amountToken: string;
  amountTokenDisplay: string;
  decimals: number;
  unitPriceUsd: number;
  status: "pending" | "confirmed" | "failed" | "expired";
  txHash: string | null;
  expiresAt: string;
  createdAt: string;
}

interface VerifyResponse {
  ok: boolean;
  status: "confirmed" | "already_confirmed" | "pending";
  reason?: string;
  tier?: string;
  expiresAt?: string;
}

const TIER_PRICE: Record<"pro" | "ultra", number> = { pro: 49, ultra: 149 };
const TIER_LABEL: Record<"pro" | "ultra", string> = { pro: "Pro", ultra: "Ultra" };

const TOKEN_BLURB: Record<string, string> = {
  ETH: "Native Ether — fastest direct settlement on Ethereum",
  USDC: "USD-pegged stablecoin — choose your network below",
  USDT: "Tether USD — choose your network below",
};

const TOKEN_ORDER = ["ETH", "USDC", "USDT"] as const;

// Verify polling cadence while a submitted tx waits for confirmations. The
// server wants 6 (ETH) / 12 (BSC) confirmations but the wallet reports the
// receipt at 1 — without this loop every mainnet payment stalled at
// "pending" with no way to retry.
const VERIFY_POLL_MS = 30_000;
// Do not invite a payment that may sit in a mempool past the immutable quote
// window. Refresh before expiry while no transaction hash is in flight.
const PAYMENT_SAFETY_BUFFER_MS = 2 * 60_000;

// Survives reloads mid-payment so we can resume verification of an
// already-broadcast tx instead of silently minting a fresh quote.
const PENDING_PAYMENT_KEY = "sov-pending-payment";

interface StoredPendingPayment {
  quoteId: string;
  txHash: string;
}

function readStoredPending(): StoredPendingPayment | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPendingPayment>;
    if (typeof parsed.quoteId === "string" && typeof parsed.txHash === "string") {
      return { quoteId: parsed.quoteId, txHash: parsed.txHash };
    }
  } catch {
    /* corrupt storage — treat as absent */
  }
  return null;
}

function writeStoredPending(entry: StoredPendingPayment | null): void {
  try {
    if (entry === null) sessionStorage.removeItem(PENDING_PAYMENT_KEY);
    else sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(entry));
  } catch {
    /* storage unavailable — resume just won't work */
  }
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tierParam = params?.get("tier");
  const tier: "pro" | "ultra" = tierParam === "ultra" ? "ultra" : "pro";

  const { status: authStatus, signIn } = useSiweAuth();
  const isAuthed = authStatus === "authed";
  const plan = usePlan();

  const [pairs, setPairs] = useState<SupportedPair[] | null>(null);
  const [pickedToken, setPickedToken] = useState<string | null>(null);
  const [pickedChain, setPickedChain] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteVersion, setQuoteVersion] = useState(0);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<VerifyResponse | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  // The quote+tx currently being verified — drives the retry poll.
  const [verifyTarget, setVerifyTarget] = useState<StoredPendingPayment | null>(null);
  // A previously-broadcast payment recovered from sessionStorage after reload.
  const [resume, setResume] = useState<{ quote: Quote; txHash: string } | null>(null);
  const verifyBusyRef = useRef(false);

  // Load supported payment pairs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/payments/quote", { cache: "no-store" });
        if (!res.ok) throw new Error(`Pairs ${res.status}`);
        const data = (await res.json()) as { pairs: SupportedPair[] };
        if (cancelled) return;
        const enabled = data.pairs.filter((p) => p.enabled);
        setPairs(enabled);
      } catch (err) {
        if (!cancelled) {
          setQuoteError(err instanceof Error ? err.message : "Failed to load options");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Group enabled pairs by token.
  const tokens = useMemo(() => {
    if (!pairs) return [];
    const set = new Set(pairs.map((p) => p.token));
    return TOKEN_ORDER.filter((t) => set.has(t));
  }, [pairs]);

  // Networks for the currently picked token.
  const networksForToken = useMemo(() => {
    if (!pairs || !pickedToken) return [];
    return pairs.filter((p) => p.token === pickedToken);
  }, [pairs, pickedToken]);

  const activePair = useMemo(() => {
    if (!pairs || !pickedChain || !pickedToken) return null;
    return pairs.find((p) => p.chain === pickedChain && p.token === pickedToken) ?? null;
  }, [pairs, pickedChain, pickedToken]);

  // Auto-create the quote whenever the picked pair changes.
  useEffect(() => {
    if (!activePair || !isAuthed) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setQuoteBusy(true);
      setQuoteError(null);
      setQuote(null);
      setVerifyState(null);
      void (async () => {
        try {
          const res = await apiFetch("/api/payments/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tier, chain: activePair.chain, token: activePair.token }),
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? `Quote ${res.status}`);
          }
          const data = (await res.json()) as Quote;
          if (!cancelled) setQuote(data);
        } catch (err) {
          if (!cancelled) {
            setQuoteError(err instanceof Error ? err.message : "Quote failed");
          }
        } finally {
          if (!cancelled) setQuoteBusy(false);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [activePair, tier, isAuthed, quoteVersion]);

  // Never leave a payable stale-price quote on screen. If no transaction is
  // in flight, refresh it immediately after its server-issued expiry.
  useEffect(() => {
    if (!quote || verifyTarget) return;
    const delay = Math.max(
      0,
      Date.parse(quote.expiresAt) - Date.now() - PAYMENT_SAFETY_BUFFER_MS,
    );
    const timeout = window.setTimeout(() => setQuoteVersion((value) => value + 1), delay);
    return () => window.clearTimeout(timeout);
  }, [quote, verifyTarget]);

  async function submitVerify(quoteId: string, txHash: string) {
    if (verifyBusyRef.current) return;
    verifyBusyRef.current = true;
    setVerifyBusy(true);
    setVerifyError(null);
    setVerifyTarget({ quoteId, txHash });
    writeStoredPending({ quoteId, txHash });
    try {
      const res = await apiFetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quoteId, txHash }),
      });
      const data = (await res.json()) as VerifyResponse & { error?: string };
      if (!res.ok && !("status" in data && data.status === "pending")) {
        if ([400, 404, 409, 410].includes(res.status)) {
          writeStoredPending(null);
          setVerifyTarget(null);
        } else if (res.status === 401 || res.status === 403) {
          // Preserve sessionStorage so re-authentication can resume the paid
          // transaction, but stop a futile unauthenticated polling loop.
          setVerifyTarget(null);
        }
        throw new Error(data.error ?? `Verify ${res.status}`);
      }
      setVerifyState(data);
      if (data.ok && (data.status === "confirmed" || data.status === "already_confirmed")) {
        writeStoredPending(null);
        setVerifyTarget(null);
        setResume(null);
        await plan.refetch();
        setTimeout(() => router.push("/plans?upgraded=" + tier), 2400);
      }
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verify failed");
      // Retryable network/server errors keep verifyTarget active so the
      // polling loop self-heals without requiring a page reload.
    } finally {
      verifyBusyRef.current = false;
      setVerifyBusy(false);
    }
  }

  // Recover a broadcast-but-unverified payment after a reload. Without this,
  // remounting auto-created a NEW quote and the already-sent tx had no path
  useEffect(() => {
    if (!isAuthed) return;
    const stored = readStoredPending();
    if (!stored) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/payments/quote?id=${encodeURIComponent(stored.quoteId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          writeStoredPending(null);
          return;
        }
        const data = (await res.json()) as Quote & { resumable?: boolean };
        if (cancelled) return;
        if (data.status === "confirmed") {
          writeStoredPending(null);
          setVerifyState({ ok: true, status: "already_confirmed", tier: data.tier });
          return;
        }
        if (data.resumable) {
          setResume({ quote: data, txHash: stored.txHash });
        } else {
          writeStoredPending(null);
        }
      } catch {
        /* leave storage in place; next mount retries */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  // Retry poll: the wallet reports a receipt at 1 confirmation but the
  // server requires 6/12, so the first verify almost always lands "pending".
  // Keep re-checking until the server confirms or the target is cleared.
  useEffect(() => {
    if (!verifyTarget) return;
    if (verifyState?.ok) return;
    const interval = setInterval(() => {
      if (verifyBusyRef.current) return;
      void submitVerify(verifyTarget.quoteId, verifyTarget.txHash);
    }, VERIFY_POLL_MS);
    return () => clearInterval(interval);
    // submitVerify is recreated per render but only reads current state; the
    // interval identity only needs to track the target + confirmation state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyTarget, verifyState?.ok]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Checkout · {TIER_LABEL[tier]}</p>
          <h1>Pay with crypto.</h1>
          <p>
            ${TIER_PRICE[tier]} / month — paid in any of the supported tokens below from
            your connected wallet. Subscription activates the moment your transaction is
            confirmed on-chain.
          </p>
        </div>
        <Link href="/plans" className="ghost-button">
          <ArrowLeft size={16} aria-hidden="true" /> Back to plans
        </Link>
      </div>

      <CommandStrip
        file="file/07.checkout"
        items={[
          { label: "tier", value: tier, tone: tier === "ultra" ? "warn" : "ok" },
          { label: "settlement", value: "on-chain", tone: "info" },
          { label: "wallet", value: isAuthed ? "connected" : "sign in", tone: isAuthed ? "ok" : "warn" },
        ]}
      />

      {isAuthed && resume ? (
        <div
          className="checkout-status tone-info"
          style={{ marginTop: 18, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}
        >
          <RefreshCw size={15} aria-hidden="true" />
          <span>
            Unverified payment found: {resume.quote.amountTokenDisplay} {resume.quote.token} for the{" "}
            {TIER_LABEL[resume.quote.tier]} plan (tx{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>{resume.txHash.slice(0, 10)}…</code>).
            We keep checking it automatically.
          </span>
          <button
            type="button"
            className="ghost-button"
            disabled={verifyBusy}
            onClick={() => submitVerify(resume.quote.id, resume.txHash)}
          >
            {verifyBusy ? "Checking…" : "Check status now"}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              writeStoredPending(null);
              setResume(null);
              setVerifyTarget(null);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {isAuthed && resume && !activePair ? (
        <div style={{ marginTop: 10 }}>
          {verifyError ? <div className="checkout-status tone-danger">{verifyError}</div> : null}
          {verifyState ? (
            <VerifyStatusNote
              state={verifyState}
              tierLabel={TIER_LABEL[resume.quote.tier]}
              busy={verifyBusy}
              onRecheck={
                verifyTarget
                  ? () => submitVerify(verifyTarget.quoteId, verifyTarget.txHash)
                  : undefined
              }
            />
          ) : null}
        </div>
      ) : null}

      {!isAuthed ? (
        <div className="paywall-card" style={{ marginTop: 22 }}>
          <div className="paywall-icon">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <p className="eyebrow">Sign in to continue</p>
          <h2>Connect your wallet</h2>
          <p>
            Subscriptions are tied to your wallet. Sign the SIWE message — no transaction is
            sent — and the checkout will quote your payment.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => void signIn()}
          >
            Sign in with wallet
          </button>
        </div>
      ) : (
        <div className="checkout-grid">
          <section className="boost-panel">
            <p className="eyebrow">1 · Pick a token</p>
            <h2 style={{ margin: "0 0 14px", fontSize: 22 }}>What do you want to pay in?</h2>
            {pairs === null ? (
              <p className="severity-medium">Loading payment options…</p>
            ) : (
              <div className="checkout-pair-grid">
                {tokens.map((token) => {
                  const active = token === pickedToken;
                  return (
                    <button
                      key={token}
                      type="button"
                      className={`checkout-pair ${active ? "is-active" : ""}`}
                      onClick={() => {
                        const matchingNetworks = pairs.filter((p) => p.token === token);
                        setPickedToken(token);
                        setPickedChain(
                          matchingNetworks.length === 1 ? matchingNetworks[0].chain : null,
                        );
                      }}
                    >
                      <strong>{token}</strong>
                      <span>{TOKEN_BLURB[token] ?? token}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {pickedToken && networksForToken.length > 1 ? (
              <>
                <p className="eyebrow" style={{ marginTop: 22 }}>Pick a network</p>
                <div className="checkout-pair-grid">
                  {networksForToken.map((p) => {
                    const active = p.chain === pickedChain;
                    return (
                      <button
                        key={p.chain}
                        type="button"
                        className={`checkout-pair ${active ? "is-active" : ""}`}
                        onClick={() => setPickedChain(p.chain)}
                      >
                        <strong>{p.chainLabel}</strong>
                        <span>Pay direct from your signed-in wallet</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}

            {quoteError ? (
              <div className="checkout-status tone-danger" style={{ marginTop: 12 }}>
                {quoteError}
              </div>
            ) : null}
          </section>

          <section className="boost-panel">
            <p className="eyebrow">2 · Send payment</p>
            <h2 style={{ margin: "0 0 14px", fontSize: 22 }}>Pay {TIER_PRICE[tier]} USD</h2>
            {!activePair ? (
              <p className="severity-medium">Pick a token to see your quote.</p>
            ) : quoteBusy || !quote ? (
              <p className="severity-medium">
                <Loader2 size={14} className="spinning" aria-hidden="true" /> Pricing the
                quote against live market data…
              </p>
            ) : (
              <PaymentExecutor
                pair={activePair}
                quote={quote}
                onTxBroadcast={(txHash) => submitVerify(quote.id, txHash)}
                verifyBusy={verifyBusy}
              />
            )}
            {verifyError ? (
              <div className="checkout-status tone-danger">{verifyError}</div>
            ) : null}
            {verifyState ? (
              <VerifyStatusNote
                state={verifyState}
                tierLabel={tier}
                busy={verifyBusy}
                onRecheck={
                  verifyTarget
                    ? () => submitVerify(verifyTarget.quoteId, verifyTarget.txHash)
                    : undefined
                }
              />
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

function VerifyStatusNote({
  state,
  tierLabel,
  busy,
  onRecheck,
}: {
  state: VerifyResponse;
  tierLabel: string;
  busy: boolean;
  onRecheck?: () => void;
}) {
  const confirmed =
    state.ok && (state.status === "confirmed" || state.status === "already_confirmed");
  return (
    <div className={`checkout-status ${confirmed ? "tone-ok" : "tone-warn"}`}>
      {confirmed ? (
        <>
          <CheckCircle2 size={15} aria-hidden="true" /> Payment confirmed — {tierLabel} plan
          active until{" "}
          {state.expiresAt ? new Date(state.expiresAt).toLocaleDateString() : "—"}. Redirecting…
        </>
      ) : (
        <>
          <RefreshCw size={15} aria-hidden="true" /> {state.reason ?? "Still pending"} —
          auto-checking every 30s.
          {onRecheck ? (
            <button
              type="button"
              className="ghost-button"
              disabled={busy}
              onClick={onRecheck}
              style={{ marginLeft: 10 }}
            >
              {busy ? "Checking…" : "Check again now"}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

interface PaymentExecutorProps {
  pair: SupportedPair;
  quote: Quote;
  onTxBroadcast: (txHash: string) => Promise<void>;
  verifyBusy: boolean;
}

function PaymentExecutor({ pair, quote, onTxBroadcast, verifyBusy }: PaymentExecutorProps) {
  return (
    <EvmPaymentExecutor
      key={quote.id}
      pair={pair}
      quote={quote}
      onTxBroadcast={onTxBroadcast}
      verifyBusy={verifyBusy}
    />
  );
}

function EvmPaymentExecutor({ pair, quote, onTxBroadcast, verifyBusy }: PaymentExecutorProps) {
  const account = useAccount();
  const { isConnected, address } = account;
  // useAccount().chainId reflects the connector's most recent chain; useChainId
  // can lag behind on manual MetaMask chain switches. Prefer the former and
  // fall back when undefined.
  const fallbackChainId = useChainId();
  const currentChainId = account.chainId ?? fallbackChainId;
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();

  const {
    sendTransactionAsync,
    isPending: sendPending,
    data: sentHash,
    error: sendError,
    reset: resetSend,
  } = useSendTransaction();

  const {
    writeContractAsync,
    isPending: writePending,
    data: wroteHash,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const txHash: Hex | undefined = sentHash ?? wroteHash;
  const { isLoading: receiptLoading, isSuccess: receiptOk } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: pair.chainId ?? undefined,
  });

  const targetChainId = pair.chainId;
  const onWrongChain = isConnected && currentChainId !== targetChainId;
  const walletMatchesQuote = Boolean(
    address && address.toLowerCase() === quote.wallet.toLowerCase(),
  );

  // Encode the actual call we'll send so the gas estimate matches the real tx.
  const txEstimate = useMemo(() => {
    if (pair.contract === null) {
      return {
        to: quote.recipientAddress as Hex,
        value: BigInt(quote.amountToken),
        data: undefined as Hex | undefined,
      };
    }
    return {
      to: pair.contract as Hex,
      value: BigInt(0),
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [quote.recipientAddress as Hex, BigInt(quote.amountToken)],
      }),
    };
  }, [pair.contract, quote.recipientAddress, quote.amountToken]);

  // Gas estimation runs against the target chain's RPC even when the wallet
  // is currently on a different chain — wagmi routes the request via the
  // configured transport for `chainId`. If the simulator reverts (the user
  // doesn't actually hold the token yet), we surface that via balance UX
  // below and fall back to typical units for the fee display.
  const {
    data: gasUnits,
    isError: gasEstError,
    isPending: gasEstPending,
  } = useEstimateGas({
    to: txEstimate.to,
    value: txEstimate.value,
    data: txEstimate.data,
    account: address,
    chainId: targetChainId,
    query: {
      enabled: isConnected && Boolean(address),
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 0, // a single revert is enough — no point hammering the RPC
    },
  });

  const { data: feesPerGas } = useEstimateFeesPerGas({
    chainId: targetChainId,
    query: {
      enabled: true, // always available — uses our public RPC, no wallet needed
      staleTime: 15_000,
      refetchInterval: 15_000,
      gcTime: 60_000,
      retry: 1,
    },
  });

  const [nativePrice, setNativePrice] = useState<{ usd: number; symbol: string } | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    // Fast path: prefer in-memory cached price by hitting the route which
    // returns 60s-cached data. Promise resolves quickly if the server has
    // it warm; only the first request per minute pays CoinGecko latency.
    const controller = new AbortController();
    fetch("/api/payments/native-prices", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { byChainId?: Record<string, { usd: number; symbol: string }> }) => {
        if (cancelled) return;
        const entry = data.byChainId?.[String(targetChainId)];
        if (entry) setNativePrice(entry);
      })
      .catch(() => {
        /* gas display is best-effort — silently degrade */
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [targetChainId]);

  // Live token-balance check so the user sees "Insufficient balance" before
  // MetaMask greets them with "This transaction is likely to fail."
  const { data: erc20Balance } = useReadContract({
    address: (pair.contract ?? undefined) as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: targetChainId,
    query: {
      enabled: pair.contract !== null && isConnected && Boolean(address),
      staleTime: 30_000,
      retry: 1,
    },
  });
  const { data: nativeBalance } = useBalance({
    address,
    chainId: targetChainId,
    query: {
      enabled: pair.contract === null && isConnected && Boolean(address),
      staleTime: 30_000,
      retry: 1,
    },
  });

  const requiredAmount = BigInt(quote.amountToken);
  const balanceAmount: bigint | null =
    pair.contract === null
      ? nativeBalance?.value ?? null
      : (erc20Balance as bigint | undefined) ?? null;
  const balanceKnown = balanceAmount !== null;
  const hasBalance = balanceAmount !== null && balanceAmount >= requiredAmount;
  const balanceDisplay =
    balanceAmount !== null
      ? formatUnits(balanceAmount, pair.decimals)
      : null;

  // Per-gas fee comes live from the chain RPC. Gas units come live from the
  // simulator when the wallet has the funds; if simulation reverts (no token
  // balance / wrong chain transient), we fall back to the deterministic
  // EVM-typical units for that transfer type so the fee display still
  // populates. These typical values are the actual measured cost of an
  // ERC-20 / native transfer — not a guess.
  const TYPICAL_UNITS = pair.contract === null ? BigInt(21_000) : BigInt(65_000);
  const maxFeePerGas: bigint | null = feesPerGas?.maxFeePerGas
    ?? feesPerGas?.gasPrice
    ?? null;
  const effectiveUnits: bigint | null =
    gasUnits !== undefined ? gasUnits : gasEstError ? TYPICAL_UNITS : null;
  const usingTypical = gasUnits === undefined && gasEstError;
  const ready = effectiveUnits !== null && maxFeePerGas !== null && nativePrice !== null;
  const gasFeeWei: bigint | null = ready ? effectiveUnits! * maxFeePerGas! : null;
  const gasFeeNative: number | null = gasFeeWei !== null ? Number(gasFeeWei) / 1e18 : null;
  const gasFeeUsd: number | null =
    gasFeeNative !== null && nativePrice ? gasFeeNative * nativePrice.usd : null;

  // Persist and submit as soon as the wallet returns a broadcast hash. The
  // server reports a retryable pending state until the receipt has enough
  // confirmations, and a page refresh cannot lose the in-flight payment.
  const submittedRef = useRef<string | null>(null);
  const [quoteExpired, setQuoteExpired] = useState(
    () => Date.parse(quote.expiresAt) - PAYMENT_SAFETY_BUFFER_MS <= Date.now(),
  );
  useEffect(() => {
    const delay = Math.max(
      0,
      Date.parse(quote.expiresAt) - Date.now() - PAYMENT_SAFETY_BUFFER_MS,
    );
    const timeout = window.setTimeout(() => setQuoteExpired(true), delay);
    return () => window.clearTimeout(timeout);
  }, [quote.expiresAt]);
  useEffect(() => {
    if (txHash && submittedRef.current !== txHash) {
      submittedRef.current = txHash;
      void onTxBroadcast(txHash);
    }
  }, [txHash, onTxBroadcast]);

  const broadcastErr = sendError?.message ?? writeError?.message ?? null;

  async function pay() {
    resetSend();
    resetWrite();
    if (!walletMatchesQuote) return;
    if (onWrongChain) {
      try {
        await switchChainAsync({ chainId: targetChainId });
      } catch {
        return;
      }
    }
    try {
      if (pair.contract === null) {
        // Native ETH / BNB
        await sendTransactionAsync({
          to: quote.recipientAddress as `0x${string}`,
          value: BigInt(quote.amountToken),
          chainId: targetChainId,
        });
      } else {
        await writeContractAsync({
          address: pair.contract as `0x${string}`,
          abi: erc20Abi,
          functionName: "transfer",
          args: [quote.recipientAddress as `0x${string}`, BigInt(quote.amountToken)],
          chainId: targetChainId,
        });
      }
    } catch {
      /* error surfaced via the hook's `error` */
    }
  }

  const buttonLabel = (() => {
    if (!isConnected) return "Wallet not connected";
    if (!walletMatchesQuote) return "Reconnect the signed-in wallet";
    if (quoteExpired) return "Refreshing expired quote…";
    if (switchPending) return "Switch chain in wallet…";
    if (onWrongChain) return `Switch to ${pair.chainLabel}`;
    if (balanceKnown && !hasBalance) return `Insufficient ${quote.token} balance`;
    if (sendPending || writePending) return "Confirm in wallet…";
    if (receiptLoading) return "Waiting for confirmations…";
    if (receiptOk) return verifyBusy ? "Verifying with server…" : "On-chain confirmed";
    return `Pay ${quote.amountTokenDisplay} ${quote.token}`;
  })();

  const disabled =
    !isConnected ||
    !walletMatchesQuote ||
    quoteExpired ||
    switchPending ||
    sendPending ||
    writePending ||
    receiptLoading ||
    receiptOk ||
    (balanceKnown && !hasBalance && !onWrongChain);

  return (
    <div className="checkout-quote">
      <div>
        <span className="pay-amount">
          {quote.amountTokenDisplay} {quote.token}
        </span>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>
          ≈ ${quote.amountUsd.toFixed(2)} · live rate ${quote.unitPriceUsd.toFixed(4)} /{" "}
          {quote.token}
        </div>
      </div>

      <div>
        <div className="checkout-row">
          <span>Network</span>
          <span>{pair.chainLabel}</span>
        </div>
        <div className="checkout-row">
          <span>Token</span>
          <span>{quote.token}</span>
        </div>
        <div className="checkout-row">
          <span>Your balance</span>
          {balanceKnown ? (
            <span style={{ color: hasBalance ? "var(--ink)" : "var(--coral)" }}>
              {balanceDisplay} {quote.token}
            </span>
          ) : (
            <span style={{ color: "var(--soft)" }}>Reading balance…</span>
          )}
        </div>
        <div className="checkout-row">
          <span>Network fee (paid by you)</span>
          {gasFeeUsd !== null && gasFeeNative !== null && nativePrice ? (
            <span>
              ~${gasFeeUsd.toFixed(2)}{" "}
              <span style={{ color: "var(--soft)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                · {gasFeeNative.toFixed(gasFeeNative < 0.001 ? 6 : 5)} {nativePrice.symbol}
                {usingTypical ? " · typical" : ""}
              </span>
            </span>
          ) : !isConnected ? (
            <span style={{ color: "var(--soft)" }}>Connect wallet to estimate</span>
          ) : gasEstPending ? (
            <span style={{ color: "var(--soft)" }}>
              <Loader2 size={12} className="spinning" aria-hidden="true" /> Estimating live gas…
            </span>
          ) : (
            <span style={{ color: "var(--soft)" }}>—</span>
          )}
        </div>
        <div className="checkout-row">
          <span>Quote expires</span>
          <span>{new Date(quote.expiresAt).toLocaleTimeString()}</span>
        </div>
      </div>

      {balanceKnown && !hasBalance ? (
        <div className="checkout-status tone-warn">
          The connected wallet only holds {balanceDisplay} {quote.token} on {pair.chainLabel} —
          you need {quote.amountTokenDisplay}. Top up the wallet or switch to a different
          token / network.
        </div>
      ) : null}

      {isConnected && !walletMatchesQuote ? (
        <div className="checkout-status tone-danger">
          The connected wallet does not match the wallet that created this quote. Reconnect the
          signed-in wallet before paying; a transfer from another address cannot activate this
          subscription.
        </div>
      ) : null}

      <button
        type="button"
        className="primary-button"
        onClick={pay}
        disabled={disabled}
        style={{ marginTop: 8 }}
      >
        <Wallet size={16} aria-hidden="true" />
        {buttonLabel}
      </button>

      <small style={{ color: "var(--soft)", fontSize: 11, lineHeight: 1.4 }}>
        Gas is paid from your wallet to the network — not to Sovereign. The estimate above
        comes live from the {pair.chainLabel} RPC and refreshes every block; the wallet
        confirmation will show the exact final amount. Activation requires{" "}
        {pair.chainId === 1 ? 6 : 12} network confirmations (~
        {pair.chainId === 1 ? "1–2 min" : "1 min"}) — we re-check automatically after you pay.
      </small>

      {txHash ? (
        <div className="checkout-status tone-info">
          <CreditCard size={14} aria-hidden="true" /> Broadcast tx{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>
            {txHash.slice(0, 10)}…{txHash.slice(-8)}
          </code>
        </div>
      ) : null}

      {broadcastErr ? (
        <div className="checkout-status tone-danger">{shortenWalletError(broadcastErr)}</div>
      ) : null}
    </div>
  );
}

function shortenWalletError(message: string): string {
  // Most wagmi/viem errors are very long; trim the leading "ContractFunctionExecutionError" line etc.
  const firstLine = message.split("\n")[0];
  if (/user rejected/i.test(message)) return "You rejected the transaction in your wallet.";
  if (firstLine.length > 220) return firstLine.slice(0, 220) + "…";
  return firstLine;
}
