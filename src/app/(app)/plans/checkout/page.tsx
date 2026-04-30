"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ExternalLink,
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

interface SupportedPair {
  chain: string;
  token: string;
  label: string;
  chainLabel: string;
  decimals: number;
  chainId: number | null;
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

const TIER_PRICE: Record<"pro" | "ultra", number> = { pro: 100, ultra: 200 };
const TIER_LABEL: Record<"pro" | "ultra", string> = { pro: "Pro", ultra: "Ultra" };

const TOKEN_BLURB: Record<string, string> = {
  ETH: "Native Ether — fastest direct settlement on Ethereum",
  USDC: "USD-pegged stablecoin — choose your network below",
  USDT: "Tether USD — choose your network below",
  BTC: "Native bitcoin — confirms in roughly 10 minutes",
  SOL: "Native Solana — finalises in seconds",
};

const TOKEN_ORDER = ["ETH", "USDC", "USDT", "BTC", "SOL"] as const;

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
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<VerifyResponse | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

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

  // Auto-pick the only network when a single-network token is chosen.
  useEffect(() => {
    if (!pickedToken) return;
    if (networksForToken.length === 1) {
      setPickedChain(networksForToken[0].chain);
    }
  }, [pickedToken, networksForToken]);

  const activePair = useMemo(() => {
    if (!pairs || !pickedChain || !pickedToken) return null;
    return pairs.find((p) => p.chain === pickedChain && p.token === pickedToken) ?? null;
  }, [pairs, pickedChain, pickedToken]);

  // Auto-create the quote whenever the picked pair changes.
  useEffect(() => {
    if (!activePair || !isAuthed) return;
    let cancelled = false;
    setQuoteBusy(true);
    setQuoteError(null);
    setQuote(null);
    setVerifyState(null);
    (async () => {
      try {
        const res = await fetch("/api/payments/quote", {
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
    return () => {
      cancelled = true;
    };
  }, [activePair, tier, isAuthed]);

  async function submitVerify(txHash: string) {
    if (!quote) return;
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quote.id, txHash }),
      });
      const data = (await res.json()) as VerifyResponse & { error?: string };
      if (!res.ok && !("status" in data && data.status === "pending")) {
        throw new Error(data.error ?? `Verify ${res.status}`);
      }
      setVerifyState(data);
      if (data.ok && (data.status === "confirmed" || data.status === "already_confirmed")) {
        await plan.refetch();
        setTimeout(() => router.push("/plans?upgraded=" + tier), 2400);
      }
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setVerifyBusy(false);
    }
  }

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
            onClick={() => signIn().catch(() => {})}
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
                        setPickedToken(token);
                        setPickedChain(null);
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
                        <span>{p.isEvm ? "Pay direct from wallet" : "External wallet"}</span>
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
                onTxBroadcast={submitVerify}
                verifyBusy={verifyBusy}
              />
            )}
            {verifyError ? (
              <div className="checkout-status tone-danger">{verifyError}</div>
            ) : null}
            {verifyState ? (
              <div
                className={`checkout-status ${
                  verifyState.ok && (verifyState.status === "confirmed" || verifyState.status === "already_confirmed")
                    ? "tone-ok"
                    : "tone-warn"
                }`}
              >
                {verifyState.ok ? (
                  <>
                    <CheckCircle2 size={15} aria-hidden="true" /> Payment confirmed — {tier}{" "}
                    plan active until {verifyState.expiresAt ? new Date(verifyState.expiresAt).toLocaleDateString() : "—"}.
                    Redirecting…
                  </>
                ) : (
                  <>
                    <RefreshCw size={15} aria-hidden="true" /> {verifyState.reason ?? "Still pending"} — try again in a minute.
                  </>
                )}
              </div>
            ) : null}
          </section>
        </div>
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
  if (pair.isEvm && pair.chainId !== null) {
    return <EvmPaymentExecutor pair={pair} quote={quote} onTxBroadcast={onTxBroadcast} verifyBusy={verifyBusy} />;
  }
  return <ManualPaymentExecutor pair={pair} quote={quote} onTxBroadcast={onTxBroadcast} verifyBusy={verifyBusy} />;
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

  const targetChainId = pair.chainId!;
  const onWrongChain = isConnected && currentChainId !== targetChainId;

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

  // When the receipt is confirmed, automatically submit it for server-side verification.
  const [submitted, setSubmitted] = useState<string | null>(null);
  useEffect(() => {
    if (receiptOk && txHash && submitted !== txHash) {
      setSubmitted(txHash);
      void onTxBroadcast(txHash);
    }
  }, [receiptOk, txHash, submitted, onTxBroadcast]);

  const broadcastErr = sendError?.message ?? writeError?.message ?? null;

  async function pay() {
    resetSend();
    resetWrite();
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
        confirmation will show the exact final amount.
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

function ManualPaymentExecutor({ pair, quote, onTxBroadcast, verifyBusy }: PaymentExecutorProps) {
  const [revealAddr, setRevealAddr] = useState(false);
  const [txHash, setTxHash] = useState("");

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
          <span>Quote expires</span>
          <span>{new Date(quote.expiresAt).toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="checkout-status tone-info">
        {pair.chainLabel} doesn&apos;t support direct in-site send. Open your{" "}
        {pair.chainLabel} wallet, send the exact amount above, then paste the transaction
        hash below.
      </div>

      {!revealAddr ? (
        <button
          type="button"
          className="ghost-button"
          onClick={() => setRevealAddr(true)}
        >
          <ExternalLink size={15} aria-hidden="true" /> Reveal deposit address
        </button>
      ) : (
        <RevealedAddress address={quote.recipientAddress} />
      )}

      <div className="filter-row" style={{ alignItems: "stretch", gap: 10 }}>
        <input
          className="number-input"
          type="text"
          placeholder="Paste your transaction hash"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 13 }}
        />
        <button
          type="button"
          className="primary-button"
          disabled={verifyBusy || txHash.trim().length < 8}
          onClick={() => onTxBroadcast(txHash.trim())}
        >
          <CreditCard size={16} aria-hidden="true" />
          {verifyBusy ? "Verifying…" : "Verify payment"}
        </button>
      </div>
    </div>
  );
}

function RevealedAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="checkout-address">
      <span style={{ color: "var(--soft)" }}>Address:</span>
      <code style={{ flex: 1 }}>{address}</code>
      <button type="button" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
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
